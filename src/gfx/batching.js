// batching.js - collapses thousands of tiny procedural meshes into a few draw calls.
//
// Meshes are grouped by material "signature". Plain-coloured opaque materials are
// baked into vertex colours so that every colour shares one material and one draw call.
// Materials flagged `userData.keep` (runtime-tinted paint, emissive lamps), transparent
// materials and textured materials keep their own batch.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();
const _n = new THREE.Matrix3();
const sharedMaterials = new Map();

function signature(mat) {
  const baked = !mat.userData.keep && !mat.transparent && !mat.map && !mat.normalMap &&
    !mat.emissiveMap && !mat.isShaderMaterial && !mat.isMeshPhysicalMaterial && !mat.wireframe;
  if (!baked) return { key: 'u:' + mat.uuid, baked: false };
  const e = mat.emissive ? mat.emissive.getHex() + ':' + mat.emissiveIntensity : '';
  const key = ['b', mat.type, mat.side, mat.roughness ?? '', mat.metalness ?? '', e, mat.flatShading ? 1 : 0, mat.fog ? 1 : 0].join('|');
  return { key, baked: true };
}

// One shared white vertex-colour material per signature (so separate batches still
// share a shader program and can be tuned together, e.g. night glow on unlit parts).
function bakedMaterial(key, source, onCreate) {
  if (!sharedMaterials.has(key)) {
    const m = source.clone();
    m.color.setRGB(1, 1, 1);
    m.vertexColors = true;
    sharedMaterials.set(key, m);
    if (onCreate) onCreate(m);
  }
  return sharedMaterials.get(key);
}

// Geometry in `matrix` space with exactly position / normal / uv (+ optional colour).
function prepare(geometry, matrix, start, count, color) {
  const src = geometry.index ? geometry.toNonIndexed() : geometry;
  const total = src.attributes.position.count;
  const s = start === undefined ? 0 : start;
  const c = count === undefined || !isFinite(count) ? total - s : Math.min(count, total - s);
  if (c <= 0) return null;

  const slice = (attr, size) => {
    if (!attr) return null;
    const out = new Float32Array(c * size);
    for (let i = 0; i < c; i++) {
      for (let k = 0; k < size; k++) out[i * size + k] = attr.getComponent(s + i, k);
    }
    return new THREE.BufferAttribute(out, size);
  };

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', slice(src.attributes.position, 3));
  const normal = slice(src.attributes.normal, 3);
  if (normal) g.setAttribute('normal', normal);
  g.setAttribute('uv', slice(src.attributes.uv, 2) || new THREE.BufferAttribute(new Float32Array(c * 2), 2));

  g.attributes.position.applyMatrix4(matrix);
  if (normal) {
    _n.getNormalMatrix(matrix);
    normal.applyNormalMatrix(_n);
  } else {
    g.computeVertexNormals();
  }

  // mirrored transforms flip the triangle winding
  if (matrix.determinant() < 0) {
    for (const name of ['position', 'normal', 'uv']) {
      const a = g.attributes[name], size = a.itemSize, arr = a.array;
      for (let t = 0; t + 2 < c; t += 3) {
        for (let k = 0; k < size; k++) {
          const i1 = (t + 1) * size + k, i2 = (t + 2) * size + k;
          const tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp;
        }
      }
    }
  }

  if (color) {
    const col = new Float32Array(c * 3);
    for (let i = 0; i < c; i++) { col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  if (src !== geometry) src.dispose();
  return g;
}

let _proxyMat = null;
function shadowProxyMaterial() {
  if (!_proxyMat) _proxyMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false });
  return _proxyMat;
}

function mergeable(o) {
  return o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && o.visible && !o.userData.noMerge && o.geometry && o.geometry.attributes.position;
}

class Buckets {
  constructor(onBakedMaterial) {
    this.map = new Map();
    this.onBakedMaterial = onBakedMaterial;
  }

  add(mesh, matrix) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const groups = Array.isArray(mesh.material) && mesh.geometry.groups.length
      ? mesh.geometry.groups
      : [{ start: undefined, count: undefined, materialIndex: 0 }];
    // group ranges refer to the index buffer, which matches vertex order once de-indexed
    for (const grp of groups) {
      const mat = mats[grp.materialIndex] || mats[0];
      if (!mat) continue;
      const sig = signature(mat);
      const geo = prepare(mesh.geometry, matrix, grp.start, grp.count, sig.baked ? mat.color : null);
      if (!geo) continue;
      if (!this.map.has(sig.key)) {
        this.map.set(sig.key, {
          material: sig.baked ? bakedMaterial(sig.key, mat, this.onBakedMaterial) : mat,
          geos: []
        });
      }
      this.map.get(sig.key).geos.push(geo);
    }
  }

  build(parent, opts) {
    let count = 0;
    const proxyParts = [];
    for (const { material, geos } of this.map.values()) {
      const casts = !!opts.castShadow && !material.transparent && !material.isMeshBasicMaterial;
      if (casts && opts.shadowProxy) {
        geos.forEach((g) => {
          const p = new THREE.BufferGeometry();
          p.setAttribute('position', g.attributes.position.clone());
          proxyParts.push(p);
        });
      }
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!merged) continue;
      if (geos.length > 1) geos.forEach((g) => g.dispose());
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, material);
      mesh.userData.noMerge = true;
      mesh.userData.batched = true;
      mesh.castShadow = casts && !opts.shadowProxy;
      mesh.receiveShadow = !!opts.receiveShadow;
      mesh.matrixAutoUpdate = opts.static !== false ? false : true;
      mesh.updateMatrix();
      parent.add(mesh);
      count++;
    }

    // One invisible mesh casts the shadow for the whole group, so the shadow pass
    // costs a single draw call here instead of one per material batch.
    if (proxyParts.length) {
      const geo = proxyParts.length === 1 ? proxyParts[0] : mergeGeometries(proxyParts, false);
      geo.computeBoundingSphere();
      const proxy = new THREE.Mesh(geo, shadowProxyMaterial());
      proxy.castShadow = true;
      proxy.matrixAutoUpdate = false;
      proxy.userData.noMerge = true;
      proxy.userData.noAO = true;
      proxy.userData.shadowProxy = true;
      parent.add(proxy);
    }
    return count;
  }
}

function prune(node, root) {
  for (let i = node.children.length - 1; i >= 0; i--) prune(node.children[i], root);
  if (node !== root && node.type === 'Group' && node.children.length === 0 && !node.userData.keepEmpty && node.parent) {
    node.parent.remove(node);
  }
}

// Flattens everything under `root` into root-space batches. Use for static scenery.
// `skip(object)` can exclude whole subtrees (they are left untouched).
export function mergeStatic(root, opts = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Buckets(opts.onBakedMaterial);
  const remove = [];

  const visit = (o) => {
    if (o !== root && (o.userData.noMerge || !o.visible || (opts.skip && opts.skip(o)))) return;
    if (mergeable(o)) {
      _m.multiplyMatrices(inv, o.matrixWorld);
      buckets.add(o, _m);
      remove.push(o);
    }
    for (const c of o.children) visit(c);
  };
  visit(root);

  // deepest first so children of merged meshes go with them
  remove.forEach((o) => { if (o.parent) o.parent.remove(o); o.geometry.dispose(); });
  prune(root, root);
  return buckets.build(root, opts);
}

// Merges an articulated rig around its animated nodes only. Every mesh is baked into
// the nearest ancestor for which `isPivot(node)` is true (the root always is), so a
// vehicle body becomes a few draw calls while wheels, forks and limbs keep moving.
export function mergeRig(root, opts = {}) {
  const isPivot = opts.isPivot || (() => true);
  const pivots = [root];
  let count = 0;
  const rel = new THREE.Matrix4();

  while (pivots.length) {
    const pivot = pivots.pop();
    const buckets = new Buckets(opts.onBakedMaterial);
    const remove = [];
    const collect = (node, matrix) => {
      for (const child of node.children) {
        if (!child.visible || child.userData.noMerge || child.isLight) continue;
        if (child.isMesh) {
          if (!mergeable(child) || child.children.length) continue;
          child.updateMatrix();
          buckets.add(child, rel.multiplyMatrices(matrix, child.matrix).clone());
          remove.push(child);
        } else if (isPivot(child)) {
          pivots.push(child);
        } else {
          child.updateMatrix();
          collect(child, new THREE.Matrix4().multiplyMatrices(matrix, child.matrix));
        }
      }
    };
    collect(pivot, new THREE.Matrix4());
    remove.forEach((m) => m.parent.remove(m));
    count += buckets.build(pivot, { ...opts, static: true });
  }
  return count;
}
