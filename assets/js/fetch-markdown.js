var markdownText = ''

async function fetchMarkdown(markdownUrl) {
  console.log('Fetch markdown from: ' + markdownUrl)
  
  try {
    markdownText = await fetch(markdownUrl).then(res => res.text())
    if (markdownText !== undefined && markdownText.length > 0) {
      console.log('Fetched markdown text')
    } else {
      console.error('Failed to fetch markdown text')
    }
  } catch (e) {
    console.error('Failed to fetch markdown text: ', e)
  }
}