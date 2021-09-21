async function fetchMarkdown(markdownUrl) {
  try {
    var markdownText = await fetch(markdownUrl).then(res => res.text())
    if (markdownText !== undefined && markdownText.length > 0) {
      navigator.clipboard.writeText(markdownText)
      document.getElementById('copy-button-text').innerText = "Markdown copied"
      document.getElementById('copy-icon').src = "../images/done-icon.svg"
    } else {
      document.getElementById('copy-error').innerText = "Failed to fetch markdown text."
      document.getElementById('copy-button-text').innerText = "Copy markdown"
      document.getElementById('copy-icon').src = "../images/copy-icon.svg"
    }
  } catch (e) {
    console.error('Failed to fetch markdown text: ', e)
    document.getElementById('copy-error').innerText = "Failed to fetch markdown text."
    document.getElementById('copy-button-text').innerText = "Copy markdown"
    document.getElementById('copy-icon').src = "../images/copy-icon.svg"
  }
}
