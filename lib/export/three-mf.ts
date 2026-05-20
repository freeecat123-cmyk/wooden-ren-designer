import { BufferGeometry, Group, Mesh } from "three";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 座標格式化：固定小數、避免科學記號。 */
function fmt(n: number): string {
  return n.toFixed(4);
}

/**
 * 把一個已組好的 three.js Group 序列化成 3MF 的 `3D/3dmodel.model` XML。
 * 每個 mesh → 一個 <object>（帶零件中文名），世界座標已 bake 進頂點，
 * <item> 用單位矩陣。單位 millimeter。
 */
export function groupToModelXml(group: Group): string {
  group.updateMatrixWorld(true);
  const objects: string[] = [];
  const items: string[] = [];
  let id = 0;

  group.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    id++;
    // clone 幾何並 bake 世界矩陣 → 頂點直接是世界座標、item 用單位矩陣
    const geom = (mesh.geometry as BufferGeometry).clone();
    geom.applyMatrix4(mesh.matrixWorld);
    const pos = geom.getAttribute("position");
    const index = geom.getIndex();

    const verts: string[] = [];
    for (let i = 0; i < pos.count; i++) {
      verts.push(
        `<vertex x="${fmt(pos.getX(i))}" y="${fmt(pos.getY(i))}" z="${fmt(pos.getZ(i))}"/>`,
      );
    }
    const tris: string[] = [];
    const triCount = index ? index.count / 3 : pos.count / 3;
    for (let t = 0; t < triCount; t++) {
      const a = index ? index.getX(t * 3) : t * 3;
      const b = index ? index.getX(t * 3 + 1) : t * 3 + 1;
      const c = index ? index.getX(t * 3 + 2) : t * 3 + 2;
      tris.push(`<triangle v1="${a}" v2="${b}" v3="${c}"/>`);
    }
    geom.dispose();

    objects.push(
      `<object id="${id}" type="model" name="${xmlEscape(mesh.name || `part-${id}`)}">` +
        `<mesh><vertices>${verts.join("")}</vertices>` +
        `<triangles>${tris.join("")}</triangles></mesh></object>`,
    );
    items.push(`<item objectid="${id}"/>`);
  });

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<model unit="millimeter" xml:lang="en-US" ` +
    `xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">` +
    `<resources>${objects.join("")}</resources>` +
    `<build>${items.join("")}</build></model>`
  );
}
