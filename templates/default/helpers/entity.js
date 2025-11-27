// templates/default/helpers/entity.js
module.exports = function (options) {
  const { id, name, type, size = 64 } = options.hash;
  if (!id || !name || !type) {
    return '';
  }

  const baseURL = this.config.imageServerUrl || 'https://images.evetech.net';
  let imagePath;
  let fallbackPath;

  switch (type) {
    case 'alliance':
      imagePath = `alliances/${id}/logo`;
      fallbackPath = `alliances/1/logo`; // Genesis alliance as a fallback
      break;
    case 'corporation':
      imagePath = `corporations/${id}/logo`;
      fallbackPath = `corporations/1/logo`; // Default corp as a fallback
      break;
    case 'character':
      imagePath = `characters/${id}/portrait`;
      fallbackPath = `characters/1/portrait`; // Default character as a fallback
      break;
    default:
      return ''; // or some default html
  }

  const imageSize = [32, 64, 128, 256, 512].find(s => s >= size) || size;

  const imageSrc = `${baseURL}/${imagePath}?size=${imageSize}`;
  const fallbackSrc = `${baseURL}/${fallbackPath}?size=${imageSize}`;

  return `
    <div class="entity-container">
      <img
        src="${imageSrc}"
        alt="${name}"
        width="${size}"
        height="${size}"
        onerror="this.onerror=null;this.src='${fallbackSrc}';"
        loading="lazy"
        class="entity-image"
      >
      <span class="entity-name">${name}</span>
    </div>
  `;
};
