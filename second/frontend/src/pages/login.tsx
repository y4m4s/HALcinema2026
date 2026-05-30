import type { PageDefinition } from '../types'

export const loginPage: PageDefinition = {
    title: 'login',
    bodyClass: 'login-page',
    styles: ['css/fonts.css', '/css/style.css'],
    html: String.raw`<div id="nav-root"></div>

    <div class="page page-enter">
        <div class="section">
            <h1 class="section-title">
                LOGIN
            </h1>
            <span class="section-title-en"></span>
            <div class="section-line"></div>
            <style>
                <div className="auth-wrap">max-with</div>
            </style>

            <div class="auth-wrap">
                <div class="auth-field">
                    <label for="auth-email">mailadress</label>
                    <input id="auth-email" type="email" autocomplete="email" placeholder="sample@example.com">

                </div>
                <div class="auth-field">
                    <label for="auth-password">password</label>
                    <input id="auth-password" type="password" autoComplete="current-password" placeholder="">
                </div>
                <div class="auth-action">
                    <button id="auth-signup" type="button">sign up</button>
                    <button id="auth-login" type="button">login</button>
                    <button id="auth-logout" type="button">logout</button>
                
                </div>
                <div id="auth-msg" class="auth-msg" role="status" aria-live="polite">
            </div>

            <div class="auth-status">
                <div>status : <span id="auth-state"></span></div>
                <div>user id : <span id="auth-uid"></span></div>
                <div>e-mail : <span id="auth-useremail"></span></div>
            </div>
            <div id="auth-secret" class="auth-secret" hidden>
                ようこそ、<span id="auth-secret-name"></span> さん。
            </div>
        </div>
    </div>`,
}