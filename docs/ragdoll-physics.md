# Ragdoll Physics Implementation

## Why Constraint-Based Ragdoll Fails

Don't try to give each body part independent position/velocity and then use distance constraints to keep them together. This fails because:

- Each frame, velocities push parts apart
- Constraints pull them back together
- But velocities persist, causing constant fighting
- No amount of iterations or stiffness fixes this

## Hierarchical Ragdoll (What Works)

Make the **torso the root** - only it has world position and velocity. Limbs store only their **rotation relative to attachment points** on the torso.

```javascript
const ragdoll = {
  // Torso is ROOT - has world position/velocity
  torso: { x, y, vx, vy, rot, vrot },

  // Limbs only have rotation - position calculated from torso
  head: { rot, vrot, damping, gravity, length },
  armGun: { rot, vrot, damping, gravity, length },
  // ...
};
```

Parts can't fly apart because limb positions are always calculated from torso.

## Rockstar-Style Loose Feel

For natural, floppy ragdoll motion:

1. **Inertia**: Limbs resist acceleration. When torso accelerates, limbs swing opposite:
   ```javascript
   const accelX = torso.vx - prevVx;
   limb.vrot += -accelX * 0.08 * Math.cos(limbAngle);
   ```

2. **Per-limb properties**: Arms looser (damping ~0.92), legs heavier (~0.94)

3. **Gravity torque**: Limbs want to hang down:
   ```javascript
   const gravityTorque = Math.sin(limbWorldAngle) * limb.gravity;
   limb.vrot -= gravityTorque;
   ```

4. **Soft joint limits**: Spring back at extremes instead of hard clamp:
   ```javascript
   if (Math.abs(limb.rot) > maxRot) {
     limb.vrot -= Math.sign(limb.rot) * excess * 0.3;
   }
   ```

5. **Impact flop**: On ground collision, add random velocity to all limbs
