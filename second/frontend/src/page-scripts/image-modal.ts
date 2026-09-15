export type ImageModalCleanup = () => void

/**
 * 画像クリックで拡大表示するモーダルの共通コンポーネント。
 *
 * - selector には <img> を含む要素 (画像のラッパー) を指定する
 * - 背景は暗い半透明で、後ろのページが透けて見える
 * - 画像以外の場所のクリック / タップ、閉じるボタン、Escape キーで閉じる
 *
 * 戻り値の関数を呼ぶと、登録したイベントと生成した DOM を破棄する。
 * ページ離脱時の cleanup として page-script の戻り値に含めること。
 */
export function initImageModal(selector: string): ImageModalCleanup {
  const noop = () => {}

  const triggers = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((el) =>
    el.querySelector('img'),
  )
  if (triggers.length === 0) return noop

  const modal = document.createElement('div')
  modal.className = 'image-modal'
  modal.hidden = true
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-modal', 'true')
  modal.setAttribute('aria-label', '画像の拡大表示')

  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.className = 'image-modal-close'
  closeButton.setAttribute('aria-label', '閉じる')
  closeButton.textContent = '×'

  const image = document.createElement('img')
  image.className = 'image-modal-image'
  image.alt = ''

  modal.append(closeButton, image)
  document.body.appendChild(modal)

  function open(source: HTMLImageElement) {
    image.src = source.currentSrc || source.src
    image.alt = source.alt
    modal.hidden = false
    document.body.classList.add('modal-open')
  }

  function close() {
    if (modal.hidden) return
    modal.hidden = true
    document.body.classList.remove('modal-open')
  }

  function onTriggerClick(e: Event) {
    const source = (e.currentTarget as HTMLElement).querySelector('img')
    if (!source) return
    open(source)
  }

  /** 画像そのもの以外をクリック / タップしたら閉じる */
  function onModalClick(e: MouseEvent) {
    if (e.target !== image) close()
  }

  function onDocumentKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') close()
  }

  triggers.forEach((trigger) => {
    trigger.classList.add('image-modal-trigger')
    trigger.addEventListener('click', onTriggerClick)
  })
  modal.addEventListener('click', onModalClick)
  document.addEventListener('keydown', onDocumentKeyDown)

  return function cleanupImageModal() {
    close()
    triggers.forEach((trigger) => {
      trigger.classList.remove('image-modal-trigger')
      trigger.removeEventListener('click', onTriggerClick)
    })
    document.removeEventListener('keydown', onDocumentKeyDown)
    modal.remove()
  }
}
