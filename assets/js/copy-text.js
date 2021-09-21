async function copyText(copyTextElementId, copyIconElementId, copiedButtonText, copiedClipboardText) {
  try {
    navigator.clipboard.writeText(copiedClipboardText)
    document.getElementById(copyTextElementId).innerText = copiedButtonText
    document.getElementById(copyIconElementId).src = "../images/done-icon.svg"
  } catch (e) {
    console.error('Failed to copy text to clipboard: ', e)
  }
}
