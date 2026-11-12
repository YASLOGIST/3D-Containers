/**
 * AKE precision-detail layer.
 *
 * Represents a generic aluminium-panel / hinged-metal-door AKE variant.
 * Deliberately NOT a manufacturer-certified ULD reconstruction: panel seams,
 * fastener pitch and cover-plate placement are illustrative until a specific
 * maker's drawings are supplied. All locations stay inside the nominal envelope.
 *
 * Fine hardware is instanced to keep close-up fidelity affordable in WebGL.
 */
import * as THREE from "three";
import { wallBox, type V2 } from "./primitives";

export interface AKEPrecisionDetailTargets {
  hull: THREE.Group;
  blind: THREE.Group;
  doorPivot: THREE.Group;
  profile: V2[];
  length: number;
  height: number;
  doorFace: number;
  doorHingeX: number;
  blindFaceZ: number;
  alloy: THREE.Material;
  steel: THREE.Material;
  includeFasteners: boolean;
}

type FastenerSite = { at: THREE.Vector3; normal: THREE.Vector3 };

/** A single instanced assembly: countersunk heads are a surface detail, not load-bearing hardware. */
export function addCaptiveFasteners(
  target: THREE.Group,
  sites: readonly FastenerSite[],
  material: THREE.Material,
  part: string,
): void {
  if (!sites.length) return;
  const geometry = new THREE.CylinderGeometry(0.0055, 0.0055, 0.0017, 12);
  const fasteners = new THREE.InstancedMesh(geometry, material, sites.length);
  fasteners.name = part;
  const from = new THREE.Vector3(0, 1, 0);
  const object = new THREE.Object3D();
  sites.forEach(({ at, normal }, i) => {
    const n = normal.clone().normalize();
    object.position.copy(at);
    object.quaternion.setFromUnitVectors(from, n);
    object.scale.set(1, 1, 1);
    object.updateMatrix();
    fasteners.setMatrixAt(i, object.matrix);
  });
  fasteners.instanceMatrix.needsUpdate = true;
  fasteners.castShadow = false;
  fasteners.receiveShadow = true;
  target.add(fasteners);
}

/**
 * Add shallow sheet-metal joints, embossed door channels, bolted service
 * covers and edge fasteners. Elements move with their existing assemblies.
 */
export function addAKEPrecisionDetails(t: AKEPrecisionDetailTargets): void {
  const { profile, length: depth, height: h } = t;
  const bottomX = profile[0].x;
  const baseWidth = profile[1].x - bottomX;
  const baseY = profile[0].y;
  const slopeDX = profile[2].x - profile[1].x;
  const slopeDY = profile[2].y - profile[1].y;
  const leftNormal = new THREE.Vector3(-1, 0, 0);
  const slantNormal = new THREE.Vector3(slopeDY, -slopeDX, 0).normalize();
  const slantUp = new THREE.Vector3(slopeDX, slopeDY, 0).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const faceNormal = new THREE.Vector3(0, 0, 1);
  const rearNormal = new THREE.Vector3(0, 0, -1);
  const seamY = baseY + (h - baseY) / 2;
  const seamHeight = Math.max(0.2, h - baseY - 0.26);
  const surfaceSites: FastenerSite[] = [];

  // Low-profile vertical joins: real skins are not a single monolithic panel.
  for (const z of [-depth * 0.235, depth * 0.235]) {
    const left = new THREE.Vector3(bottomX + 0.009, seamY, z);
    const slopeT = (seamY - baseY) / (h - baseY);
    const slopeX = profile[1].x + slopeDX * slopeT;
    const right = new THREE.Vector3(slopeX, seamY, z)
      .addScaledVector(slantNormal, -0.009);
    for (const [at, normal, rise] of [
      [left, leftNormal, up],
      [right, slantNormal, slantUp],
    ] as const) {
      const channel = wallBox(
        t.alloy, 0.006, seamHeight, 0.0035,
        normal, rise, at, "AKE panel joint - raised seam", 0.001,
      );
      channel.castShadow = false;
      t.hull.add(channel);
      if (t.includeFasteners) {
        for (const offset of [-0.4, -0.2, 0, 0.2, 0.4]) {
          surfaceSites.push({
            at: at.clone().addScaledVector(rise, offset * seamHeight)
              .addScaledVector(normal, 0.0031),
            normal,
          });
        }
      }
    }
  }
  if (t.includeFasteners) {
    addCaptiveFasteners(
      t.hull, surfaceSites, t.steel, "AKE skin joint microfasteners",
    );
  }

  // Formed door channels and service-head fasteners are attached to the
  // hinge pivot, so camera inspection and door animation remain consistent.
  const doorCenter = bottomX + baseWidth * 0.51 - t.doorHingeX;
  for (const y of [0.78, 1.04]) {
    const rib = wallBox(
      t.alloy, baseWidth * 0.48, 0.014, 0.005,
      faceNormal, up, new THREE.Vector3(doorCenter, y, t.doorFace + 0.005),
      "AKE door pressed reinforcement channel", 0.003,
    );
    rib.castShadow = false;
    t.doorPivot.add(rib);
  }

  const doorSites: FastenerSite[] = [];
  if (t.includeFasteners) {
    for (const y of [0.78, 1.04]) {
      for (const dx of [-baseWidth * 0.22, baseWidth * 0.22]) {
        doorSites.push({
          at: new THREE.Vector3(doorCenter + dx, y, t.doorFace + 0.009),
          normal: faceNormal,
        });
      }
    }
    // Repairable latch cover hardware, offset from the mechanical rods.
    for (const y of [0.33, 0.9, 1.35]) {
      for (const x of [bottomX + 0.18, bottomX + baseWidth - 0.18]) {
        doorSites.push({
          at: new THREE.Vector3(x - t.doorHingeX, y, t.doorFace + 0.005),
          normal: faceNormal,
        });
      }
    }
    addCaptiveFasteners(
      t.doorPivot, doorSites, t.steel, "AKE door captive screw heads",
    );
  }

  // Recessed lower access covers on the blind end, without obscuring the
  // main livery or the data plate. Thin panels remain within the outer frame.
  const blindSites: FastenerSite[] = [];
  for (const x of [bottomX + 0.19, bottomX + baseWidth - 0.19]) {
    const plate = wallBox(
      t.alloy, 0.095, 0.07, 0.003,
      rearNormal, up,
      new THREE.Vector3(x, baseY + 0.045, t.blindFaceZ - 0.003),
      "AKE blind-end service cover", 0.008,
    );
    t.blind.add(plate);
    if (t.includeFasteners) {
      for (const dx of [-0.031, 0.031]) {
        blindSites.push({
          at: new THREE.Vector3(
            x + dx, baseY + 0.045, t.blindFaceZ - 0.006,
          ),
          normal: rearNormal,
        });
      }
    }
  }
  if (t.includeFasteners) {
    addCaptiveFasteners(
      t.blind, blindSites, t.steel, "AKE blind-end cover screws",
    );
  }
}
