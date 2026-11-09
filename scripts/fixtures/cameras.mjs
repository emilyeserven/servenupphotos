// Sample answers for the routes in routes_cameras.go.
import { FOLDER, added, pendingSave } from "./shared.mjs";

/** The sample answers for the cameras routes, keyed "METHOD /api/path". */
export function camerasFixtures() {
  return {
    "DELETE /api/cameras/x-t5": () => ({
      ...pendingSave(),
      path: `${FOLDER}/cameras/x-t5.json`,
      data: null,
      before: added.cameras[0].data,
      changed: true,
    }),
    "PUT /api/cameras/x-t5": ({ body }) => ({
      ...pendingSave(),
      path: `${FOLDER}/cameras/x-t5.json`,
      data: body,
      before: added.cameras[0].data,
      changed: true,
    }),
    "DELETE /api/lenses/7artisans-12mm-f2-8": () => ({
      ...pendingSave(),
      path: `${FOLDER}/lenses/7artisans-12mm-f2-8.json`,
      data: null,
      before: added.lenses[0].data,
      changed: true,
    }),
    "PUT /api/lenses/7artisans-12mm-f2-8": ({ body }) => ({
      ...pendingSave(),
      path: `${FOLDER}/lenses/7artisans-12mm-f2-8.json`,
      data: body,
      before: added.lenses[0].data,
      changed: true,
    }),
    "POST /api/gear/image": {
      key: "gear/originals/6f7e8d9c0b1a-lens.jpg",
      url: "https://cdn.servenupphotos.net/gear/originals/6f7e8d9c0b1a-lens.jpg",
      width: 1200,
      height: 800,
      subject: { x: 0.55, y: 0.15, width: 0.3, height: 0.4 },
    },
    "POST /api/gear/crop": {
      key: "gear/7a8b9c0d1e2f-lens.webp",
      url: "https://cdn.servenupphotos.net/gear/7a8b9c0d1e2f-lens.webp",
    },
    "DELETE /api/gear/camera-fujifilm-x-t5": () => ({
      ...pendingSave(),
      path: `${FOLDER}/gear/camera-fujifilm-x-t5.json`,
      data: null,
      before: added.gear[0].data,
      changed: true,
    }),
    "PUT /api/gear/camera-fujifilm-x-t5": ({ body }) => ({
      ...pendingSave(),
      path: `${FOLDER}/gear/camera-fujifilm-x-t5.json`,
      data: body,
      before: added.gear[0].data,
      changed: true,
    }),
  };
}
