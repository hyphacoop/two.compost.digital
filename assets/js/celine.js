var searchParams = new URLSearchParams(window.location.search)
var entries = searchParams.entries()

for (let e of entries) {
  var url = `/pieces/celine/${e[1]}${window.location.search}`
  var segment = document.getElementById(`segment-${e[0]}`)
  var segmentLink = document.getElementById(`segment-${e[0]}`)
  if (segmentLink) {
    segmentLink.href = url
  }
}

var allSegments = document.querySelector('.timeline-segment.selected')
var currentSegment = document.querySelector('.timeline-segment.selected')
var currentSegmentId = currentSegment.dataset.segment

var pageLinks = document.querySelectorAll('.page-link')

pageLinks.forEach(link => {
  var linkHref = link.href
  var titleMatch = linkHref.match(/\/pieces\/celine\/(.*)$/)
  if (titleMatch && titleMatch[1].length) {
    var title = titleMatch[1]
    const hrefWithParams = `${linkHref}${window.location.search || '?'}&${parseInt(currentSegmentId)+1}=${title}`
    link.href = hrefWithParams
  }
})
