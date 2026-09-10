import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { environment } from '../../../../environment';

interface Banner {
  _id: string;
  title: string;
  subtitle?: string;
  button_label?: string;
  button_link?: string;
  image_url?: string | null;
  theme?: string;
  image_side?: string;
  image_scale?: number;
  image_offset_x?: number;
  image_offset_y?: number;
  image_scale_mobile?: number;
  image_offset_x_mobile?: number;
  image_offset_y_mobile?: number;
  show_glow?: boolean;
}

const KNOWN_THEMES = ['ocean', 'cream', 'forest'];

/**
 * Home page ka promo banner — content poora admin panel se aata hai.
 *
 * Image background-less PNG hoti hai aur banner ka rang theme se aata hai,
 * isliye ek hi cut-out image teeno themes par saaf baithti hai. Image ki
 * jagah (side / scale / nudge) bhi admin set karta hai — har PNG ka apna
 * padding aur aspect ratio hota hai, ek fixed layout sab par theek nahi lagta.
 */
@Component({
  selector: 'app-home-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home-banner.html',
  styleUrl: './home-banner.css',
})
export class HomeBanner implements OnInit {
  banners: Banner[] = [];
  readonly imageBase = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private router: Router,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.http.get<{ banners: Banner[] }>(`${environment.apiUrl}/banners`).subscribe({
      next: (res) => {
        this.banners = res?.banners || [];
        this.cdr.detectChanges();
      },
      // Banner home page ka side element hai — fail ho to chup-chaap kuch mat
      // dikhao, poora home page usi ki wajah se kharab nahi hona chahiye.
      error: () => {
        this.banners = [];
      },
    });
  }

  /** Theme + image side + glow — sab classes me. Anjaan theme default par girta hai. */
  cardClass(banner: Banner): string {
    const theme = banner.theme && KNOWN_THEMES.includes(banner.theme) ? banner.theme : 'ocean';
    const side = banner.image_side === 'left' ? 'left' : 'right';
    const glow = banner.show_glow === false ? '' : ' hb-glow';
    return `hb-card hb-${theme} hb-img-${side}${glow}`;
  }

  /**
   * Placement CSS variables ke through jaata hai, inline transform se nahi —
   * isi wajah se media query me mobile ke apne variables use ho paate hain.
   *
   * Desktop aur mobile ke values alag hain: jo scale bade banner par theek
   * lagta hai wo phone ke chhote banner me aksar bahut bada nikalta hai.
   */
  cardVars(banner: Banner): SafeStyle {
    const scale = (banner.image_scale ?? 100) / 100;
    const x = banner.image_offset_x ?? 0;
    const y = banner.image_offset_y ?? 0;

    const mScale = (banner.image_scale_mobile ?? 100) / 100;
    const mX = banner.image_offset_x_mobile ?? 0;
    const mY = banner.image_offset_y_mobile ?? 0;

    return this.sanitizer.bypassSecurityTrustStyle(
      `--hb-scale:${scale}; --hb-x:${x}px; --hb-y:${y}px;` +
        `--hb-scale-m:${mScale}; --hb-x-m:${mX}px; --hb-y-m:${mY}px;`
    );
  }

  /** Andar ka route Angular router se, bahar ka link naye tab me. */
  openLink(banner: Banner): void {
    const link = (banner.button_link || '').trim();
    if (!link) return;

    if (/^https?:\/\//i.test(link)) {
      window.open(link, '_blank', 'noopener');
      return;
    }
    this.router.navigateByUrl(link.startsWith('/') ? link : `/${link}`);
  }
}
