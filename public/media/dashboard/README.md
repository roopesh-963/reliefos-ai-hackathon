Place dashboard cinematic assets here:

- `public/media/dashboard/crsisvideo.mp4`
- `public/media/dashboard/command-center.glb`

The dashboard backdrop auto-detects both files.

- If the video is present, it becomes the fullscreen cinematic background.
- If the model is present, it loads into the interactive 3D canvas.
- If either file is missing, the dashboard falls back gracefully without breaking UI functionality.
