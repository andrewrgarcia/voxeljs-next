import * as util from "../utils.js"
import {System} from '../../node_modules/ecsy/build/ecsy.module.js?module'
import {Quaternion, Ray, Vector2, Vector3} from '../../node_modules/three/build/three.module.js'
import {Camera, Object3D, Transform} from '../../node_modules/ecsy-three/build/ecsy-three.module-unpkg.js'
import {traceRay} from "../raycast.js"
import {StagePosition, StageRotation} from './camera_gimbal.js'
import {MouseCursor, MouseDownTrigger} from './mouse.js'
import {VoxelLandscape} from './voxels.js'

export class Highlight {
}
export class ActiveBlock {
    constructor() {
        this.type = 1;
    }
}


export class HighlightSystem extends System {
    init() {
    }
    traceRayAtScreenCoords(
        stageRot, stagePos, domElement, camera,
        chunkManager, pt, distance) {
        const ray = new Ray()

        // e = e.changedTouches[0]
        const mouse = new Vector2()
        const bounds = domElement.getBoundingClientRect()
        mouse.x = ((pt.x - bounds.left) / bounds.width) * 2 - 1
        mouse.y = -((pt.y - bounds.top) / bounds.height) * 2 + 1

        ray.origin.copy(camera.position)
        ray.direction.set(mouse.x, mouse.y, 0.5).unproject(camera).sub(ray.origin).normalize()
        // console.log("new bounds is",mouse,camera)
        // console.log("stage pos is",stagePos)

        stagePos.worldToLocal(ray.origin)
        ray.origin.add(new Vector3(0,0,-0.5))
        const quat = new Quaternion()
        quat.copy(stageRot.quaternion)
        quat.inverse()
        ray.direction.applyQuaternion(quat)

        const hitNormal = new Vector3(0,0,0)
        const hitPosition = new Vector3(0,0,0)
        // console.log("chunk manager is", chunkManager)
        const hitBlock = traceRay(chunkManager,ray.origin,ray.direction,distance,hitPosition,hitNormal,util.EPSILON)
        return {
            hitBlock:hitBlock,
            hitPosition:hitPosition,
            hitNormal: hitNormal
        }
    }
    execute(delta,time) {
        this.queries.mouse.results.forEach(mousEnt => {
            let mouse = mousEnt.getComponent(MouseCursor)
            let stageRot = this.queries.stageRot.results[0].getComponent(Object3D).value
            let stagePos = this.queries.stagePos.results[0].getComponent(Object3D).value;
            this.queries.landscape.results.forEach(ent=>{
                const landscape = ent.getComponent(VoxelLandscape);
                this.queries.highlights.results.forEach(ent => {
                    // console.log("checking",mouse.position, stageRot, stagePos);
                    const domElement = document.querySelector("canvas")
                    const camera = this.queries.camera.results[0].getComponent(Object3D).value
                    const distance = 10;

                    const res = this.traceRayAtScreenCoords(
                        stageRot, stagePos, domElement, camera,
                        landscape.chunkManager, mouse.position, distance)
                    //console.log("res is",res);
                    res.hitPosition.floor()

                    //move the highlight
                    let tran = ent.getMutableComponent(Transform);
                    tran.position.copy(res.hitPosition)

                    //if left button
                    if(mousEnt.hasComponent(MouseDownTrigger)) {
                        mousEnt.removeComponent(MouseDownTrigger)
                        let md = mousEnt.getComponent(MouseCursor)
                        let pos = res.hitPosition.clone()
                        if(md.buttons === 1){
                            pos.add(res.hitNormal)
                            pos.floor()
                            let active = this.queries.active.results[0]
                            landscape.chunkManager.setVoxelAtCoordinates(pos,active.getComponent(ActiveBlock).type)
                        }
                        if(md.buttons === 2) {
                            // pos.add(res.hitNormal)
                            pos.floor()
                            landscape.chunkManager.setVoxelAtCoordinates(pos,0)
                        }
                    }
                })
            })
        })
        this.queries.mouse_down.added.forEach(me=>{
            console.log("a mouse down happened");
        })
    }
}
HighlightSystem.queries = {
    highlights: { components: [Highlight]},
    stagePos: { components: [StagePosition]},
    stageRot: { components: [StageRotation]},
    mouse: { components:[MouseCursor] },
    mouse_down: {
        components:[MouseCursor,MouseDownTrigger],
        listen: {
            added:[MouseDownTrigger]
        }
    },
    camera: { components:[Camera] },
    landscape: { components:[VoxelLandscape]},
    active: { components:[ActiveBlock]}
}
