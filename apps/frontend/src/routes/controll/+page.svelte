<script lang="ts">
    import {FilesetResolver,HandLandmarker,DrawingUtils} from "@mediapipe/tasks-vision"
    import { onMount,onDestroy } from "svelte";

    let videoElement : HTMLVideoElement | null = null;
    let canvasElement : HTMLCanvasElement | null = null;
    let result = "";
    let handlm: HandLandmarker | null = null;
    let stream: MediaStream | null = null;

    let THRESHOLD = 0.07;

    let lm:any = [];

    const init = async () => {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        handlm = await HandLandmarker.createFromOptions(
            vision,
            {
                baseOptions: {
                    modelAssetPath : "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",

                    delegate: "GPU"
                },
                numHands: 1,
                runningMode: "VIDEO",
            }
        )

        stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        });
        if (!videoElement) return;
        videoElement.srcObject = stream;
        await videoElement.play();

        let cameraWidth = videoElement.videoWidth;
        let cameraHeight = videoElement.videoHeight;


        if(!canvasElement) return;
        canvasElement.width = 480 * (cameraWidth / cameraHeight);
        const canvasCtx = canvasElement.getContext("2d");
        if (!canvasCtx) return;
        const gl = canvasElement.getContext("webgl2") as WebGL2RenderingContext;
        const drawingUtils = new DrawingUtils(canvasCtx,gl);


        const detectHands = async () => {
            if (!videoElement || !canvasElement || !handlm) return;

            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

            const results = await handlm.detectForVideo(videoElement, performance.now());
            if (results.landmarks.length) {
                lm = results.landmarks[0]
                drawingUtils.drawLandmarks(lm, {
                    color: "#FF0000",
                    radius: 5
                });
                
            }
            requestAnimationFrame(detectHands);
        };
        detectHands();
    }

    const cleanup = () => {
        handlm?.close();
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    };

    onMount(() => {
        init();
    })

    onDestroy(() => {
        cleanup();
    });
</script>

<div>
    <!-- svelte-ignore a11y_media_has_caption -->
    <video width="640" height="480" bind:this={videoElement} autoplay muted playsinline 
        style="display: none;">
    </video>
    <canvas width="640" height="480" bind:this={canvasElement}></canvas>

    <input type="number" bind:value={THRESHOLD} min="0" max="10" step="0.1" />
    <p>{result}</p>
</div>