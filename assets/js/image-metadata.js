function getExif() {

  var img2 = document.getElementById("img2");
  EXIF.getData(img2, function() {
    var allMetaData = EXIF.getAllTags(this);
    var allMetaDataSpan = document.getElementById("allMetaDataSpan");
    allMetaDataSpan.innerHTML = JSON.stringify(allMetaData, null, "\t");
  });
}

window.onload = getExif()