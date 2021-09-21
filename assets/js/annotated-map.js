async function initMap(id, imagePath, annotationsPath, iconPath) {
  var viewer = window.viewer = OpenSeadragon({
    id: id,
    prefixUrl: `../js/vendor/openseadragon-bin-2.4.2/images/`,
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
        const size = item.size || "default"
        return html`<img src="../${item.url}" class="size-${size}">`
      } else if (item.type === 'audio') {
        return html`<audio controls src="../${item.url}">`
      }
    }
    
    infoEl.innerHTML = ''

    if (annotation) {
      let contentEl = html`
        <div class="mesh-map-info-content" onclick=${(e) => e.stopPropagation()}>
        </div>
      `

      if (annotation.title) {
        let titleEl = html`<p class="title">${annotation.title}</p>`
        contentEl.appendChild(titleEl)
      }

      annotation.media.map(item => {
        const mediaEl = makeMediaElement(item)
        contentEl.appendChild(mediaEl)
      })

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
      placement: OpenSeadragon.Placement.RIGHT,
      checkResize: false,
      className: "mesh-marker"
    }


    let markerElement = html`<img
      class="mesh-marker"
      src=${iconPath}
      alt="Annotation marker"
      annotation-id="${annotation.id}"
      width="40"
      height="40"
      >`

    marker.element = markerElement
    viewer.addOverlay(marker)
  })

  // Do not zoom in when clicking on the canvas to dismiss the popup
  viewer.addHandler('canvas-click', (event) => {
    let el = event.originalEvent.target
    if (event.quick && el.classList.contains('mesh-marker')) {
      let annotation = annotations.find(a => a.id === parseInt(el.getAttribute('annotation-id')))
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
