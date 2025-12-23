import { Component } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <div class="container">
      <div class="row" style="align-items:center; justify-content:space-between; margin-bottom:14px;">
        <div>
          <div class="small"></div>
          <div style="font-weight:800;"></div>
        </div>
        <div class="row" style="gap:8px;">
          <a routerLink="/solicitacoes" class="small" style="text-decoration:none; color: var(--primary);">+ Adiantamento</a>
          <a routerLink="/reembolso/novo" class="small" style="text-decoration:none; color: var(--primary);">+ Reembolso</a>
        </div>
      </div>

      <router-outlet></router-outlet>

      <div class="small" style="margin-top:24px;">
        
      </div>
    </div>
  `,
})
export class AppComponent {
  mockEnabled = (window as any).__USE_MOCKS__ === true;
}
