import * as THREE from "three";

/**
 * Builds a canvas-texture mesh showing the role title and tenure period,
 * intended to be mounted on the front of an experience pedestal.
 *
 * @param {string} title   – job role / title
 * @param {string} tenure  – human-readable date range (e.g. "Jan 2022 – Mar 2024")
 * @returns {THREE.Mesh | null}
 */
export const makePlaque = (title, tenure) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;

  canvas.width = 768;
  canvas.height = 256;

  context.fillStyle = "rgba(12, 28, 22, 0.92)";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(123, 234, 199, 0.42)";
  context.lineWidth = 8;
  context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  context.textAlign = "center";
  context.textBaseline = "middle";

  context.fillStyle = "#dbfff2";
  context.font = "700 58px Sora, sans-serif";
  context.fillText(tenure, canvas.width / 2, canvas.height / 2 - 26);

  context.fillStyle = "rgba(175, 230, 212, 0.9)";
  context.font = "600 30px Sora, sans-serif";
  context.fillText(title, canvas.width / 2, canvas.height / 2 + 48);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  return new THREE.Mesh(
    new THREE.PlaneGeometry(2.7, 0.9),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true })
  );
};
