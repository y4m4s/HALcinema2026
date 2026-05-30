import { auth } from '../firebase'
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    type User,
} from 'firebase/auth'


//
let unsubscribe: (() => void) | null = null

export function runLogin() {
    const byId = <T extends HTMLElement>(id: string) =>
        document.getElementById(id) as T | null

    const emailEl = byId<HTMLInputElement>('auth-email')
    const passwordEl = byId<HTMLInputElement>('auth-password')
    const signupBtn = byId<HTMLButtonElement>('auth-signup')
    const loginBtn = byId<HTMLButtonElement>('auth-login')
    const logoutBtn = byId<HTMLButtonElement>('auth-logout')
    const msgEl = byId('auth-msg')
    const stateEl = byId('auth-state')
    const uidEl = byId('auth-uid')
    const userEmailEl = byId('auth-useremail')
    const secretEl = byId('auth-secret')
    const secretNameEl = byId('auth-secret-name')

    if (!emailEl || !passwordEl || !signupBtn || !loginBtn || !logoutBtn) return

    const setMsg = (text: string, kind: 'ok' | 'error' | '' = '') => {
        if (!msgEl) return
        msgEl.textContent = text
        msgEl.className = 'auth-msg' + (kind ? '' + kind : '')
    }

    const setBusy = (busy: boolean) => {
        signupBtn.disabled = busy
        loginBtn.disabled = busy
    }

    const errorMessage = (e: unknown) => {
        const code = ( e as { code?: string }).code ?? ''
        switch (code){
            case 'auth/invaild-email':
                return 'メールアドレスの形式が正しくありません'
            case 'auth/missing-password':
                return 'パスワードを入力してください'
            case 'auth/weak-password':
                return 'パスワードは６文字以上にしてください'
            case 'auth/email-already-in use':
                return 'このメールアドレスはすでに使われています'
            case 'auth/invaild-credential':
                return ''
            case 'auth/wrong-password':
                return ''
            case 'auth/user-not-found':
                return 'パスワードもしくはメールアドレスが間違っています'
            
            default:
                return (e as { message?: string}).message ?? 'unknown error'
        }
    }

    signupBtn.onclick = async () => {
        setBusy(true)
        setMsg('Signing in...')
        try {
            await createUserWithEmailAndPassword(auth, emailEl.value.trim(), passwordEl.value)
            setMsg('Signed in', 'ok')
        }
        catch (e){
            setMsg(errorMessage(e), 'error')
        }
        finally{
            setBusy(false)
        }
    }


    loginBtn.onclick = async () => {
        setBusy(true)
        setMsg('Logging in...')
        try {
            await signInWithEmailAndPassword(auth, emailEl.value.trim(), passwordEl.value)
            setMsg('Logged in', 'ok')
        }
        catch (e){
            setMsg(errorMessage(e), 'error')
        }
        finally{
            setBusy(false)
        }
    }

    logoutBtn.onclick = async () => {
        try{
            await signOut(auth)
            setMsg('logged out', 'ok')
        }
        catch (e){
            setMsg(errorMessage(e), 'error')
        }
    }

    const render = (user: User | null) => {
        if(stateEl) stateEl.textContent = user ? 'ログイン済み' : 'ゲスト'
        if(uidEl) uidEl.textContent = user?.uid ?? ''
        if(userEmailEl)  userEmailEl.textContent = user?.email ?? ''
        if(secretNameEl) secretNameEl.textContent = user?.email ?? ''
        if(secretEl) secretEl.hidden = !user
        logoutBtn.disabled = !user
    }
    if (unsubscribe) unsubscribe()
    unsubscribe = onAuthStateChanged(auth, render)
}