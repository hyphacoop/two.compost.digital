async function initMap(id, imagePath, annotationsPath) {
  var viewer = window.viewer = OpenSeadragon({
    id: id,
    prefixUrl: `/js/vendor/openseadragon-bin-2.4.2/images/`,
    tileSources: {
      type: "image",
      url: imagePath
    },
    useCanvas: false
  })

  let annotations = await fetch(annotationsPath).then(res => res.json())
  console.log(annotations)
  
  let infoEl = html`<div id="mesh-map-info-container"></div>`
  document.querySelector('.openseadragon-container').appendChild(infoEl)

  const renderInfo = (annotation) => {
    const makeMediaElement = (item) => {
      if (item.type === 'image') {
        return html`<img src="../${item.url}">`
      } else if (item.type === 'audio') {
        return html`<audio controls src="../${item.url}">`
      }
    }
    
    infoEl.innerHTML = ''

    if (annotation) {
      let contentEl = html`
        <div class="mesh-map-info-content" onclick=${(e) => e.stopPropagation()}>
          ${annotation.media.map(item => makeMediaElement(item))}
        </div>
      `
      let textEl = html`<pre class="text"></pre>`
      textEl.innerHTML = annotation.text
      contentEl.appendChild(textEl)
      infoEl.appendChild(contentEl)
    }
  }

  let width = 8335
  let height = 4750

  annotations.forEach(annotation => {
    let marker = {
      id: annotation.id,
      x: annotation.x / width + 0.025,
      y: 0.6 * annotation.y / height,
      width: annotation.w / width,
      height: 0.6 * annotation.h / height,
      placement: 'CENTER',
      checkResize: false,
      className: "mesh-marker"
    }
    
    let markerElement = html`<div
      class="mesh-marker"
      alt="Click to see annotation"
      annotation-id="${annotation.id}"></div>`

    marker.element = markerElement
    viewer.addOverlay(marker)
  })

  // Do not zoom in when clicking on the canvas to dismiss the popup
  viewer.addHandler('canvas-click', (event) => {
    let el = event.originalEvent.target
    if (event.quick && el.classList.contains('mesh-marker')) {
      let annotation = annotations.find(a => a.id === parseInt(el.getAttribute('annotation-id')))
      console.log("annotation", annotation)
      el.classList.add('visited')
      renderInfo(annotation)
      event.preventDefaultAction = true
    } else if (infoEl.children.length > 0) {
      renderInfo(null)
      event.preventDefaultAction = true  
    }
  })

  document.addEventListener('click', (event) => {
    if (!event.target.classList.contains('mesh-marker')) {
      renderInfo(null)
    }
  })
}
