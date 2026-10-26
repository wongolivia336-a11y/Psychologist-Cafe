# 静物资产 prompts

本轮先把缺失资产落成可复用的 prompt，并将一张低对比度矿物纸张纹理接入页面：

- 已生成并接入：`public/assets/mineral-paper-grain-v1.webp`
- 生成方式：内置 image generation，原始 1254px 纹理压缩为 768px WebP，约 130KB。
- 当前 3D 场景仍使用程序化几何；没有把未验证的 Blender/GLB 文件冒充成已完成资产。

## 1. Blender / GLB：桌面静物套件

```text
Create a small production-ready still-life asset kit for a quiet philosophical cafe scene.
Export four separate GLB files: a shallow ceramic plate, a thin drinking glass, a folded paper sheet,
and a vintage pocket watch. Use real-world scale in meters, clean pivots at the contact point,
applied transforms, named materials, and sensible origin placement. The camera should read as a
slightly elevated tabletop view. Materials: cool bone ceramic with subtle roughness variation,
thin translucent blue-gray glass with a readable rim, matte off-white paper with a soft edge,
and desaturated blue steel for the watch. Keep topology economical for mobile WebGL; no bevel
subdivision above what is visually necessary; no text, logos, food, hands, or people. Deliver
separate meshes and a mobile LOD for each asset. The assets must look good under a cool soft key
light and a muted teal fill light.
```

验收：每个 GLB 都能独立加载；材质不依赖 Blender 本地路径；移动端单资产尽量控制在 50k triangles 内；
提供 `plate.glb`、`glass.glb`、`paper.glb`、`pocket-watch.glb` 和一份 license/author 说明。

## 2. Image generation：背景 / 纸张材质

```text
Use case: stylized-concept
Asset type: seamless website material texture for a cold still-life theater
Primary request: a subtle mineral paper and graphite grain texture for a tiled Three.js scene
Scene/backdrop: flat square texture, no perspective, no horizon
Style/medium: refined editorial material study, matte and tactile, low contrast
Color palette: pale blue-gray, bone white, muted slate, trace of desaturated teal
Constraints: no objects, no plate, no food, no glass, no hands, no people, no logo, no text, no watermark
Avoid: warm brown dashboard colors, glossy highlights, dramatic shadows, decorative patterns
```

## 3. 记忆物件变体

```text
Generate six isolated still-life object cutouts for a restrained philosophical cafe interface:
an old coin, a family photograph with no readable faces, an empty plate, a single key, a folded
school uniform, and an unposted letter. Editorial object photography, cool mineral light, muted
blue-gray and bone palette, transparent background, centered object, consistent scale and camera,
no readable text, no logos, no people, no food metrics, no watermark. Produce one transparent PNG
per object and keep the silhouette legible at 64px.
```

## 4. Three.js 接入约束

- 首选 GLB + `GLTFLoader`，不要把大图当作 3D 模型替代品。
- 资产加载失败时保留程序化几何或 Canvas 回退；不能因为 WebGL/GLB 失败而白屏。
- 纹理首选 WebP/KTX2，首屏不预加载未使用的桌位资产。
- 不把“餐盘内容”解释成营养、重量、热量、完成度或身体评价。
