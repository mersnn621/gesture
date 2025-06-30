<script lang="ts">
    import {FilesetResolver,HandLandmarker,DrawingUtils} from "@mediapipe/tasks-vision"
    import { onMount,onDestroy } from "svelte";

    let videoElement = $state<HTMLVideoElement | null>(null);
    let canvasElement = $state<HTMLCanvasElement | null>(null);
    let result = $state("");
    let handlm: HandLandmarker | null = null;
    let stream: MediaStream | null = null;

    let THRESHOLD = $state(0.2);

    let lm:any = [];
    let FINGERS = [0,4,8];

    let isReady = $state(false);

    let cameras = $state<MediaDeviceInfo[]>([]);
    let selectedCamera = $state<string | null>(null);

    const selectCamera = async () => {
        const devices = await navigator.mediaDevices.enumerateDevices();
        cameras = (devices.filter(device => device.kind === 'videoinput'));
        console.log(cameras);
    };

    const init = async () => {
        console.log(selectedCamera || "No camera selected");
        isReady = true;
        
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
            video: {
                deviceId: selectedCamera || undefined
            },
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
                let lm_filtered = lm.filter((_:never, i: number) => FINGERS.includes(i));
                let distance1 = Math.sqrt(
                    Math.pow(lm_filtered[0].x - lm_filtered[1].x, 2) +
                    Math.pow(lm_filtered[0].y - lm_filtered[1].y, 2)
                );
                let distance2 = Math.sqrt(
                    Math.pow(lm_filtered[1].x - lm_filtered[2].x, 2) +
                    Math.pow(lm_filtered[1].y - lm_filtered[2].y, 2)
                );
                drawingUtils.drawLandmarks(lm_filtered, {
                    color: "#FF0000",
                    radius: 5
                });
                result = `Distance: ${distance1.toFixed(2)} ${distance2.toFixed(2)}, ${distance2/distance1 > THRESHOLD ? "Open" : "Closed"}`;
                if(distance2/distance1 <= THRESHOLD){
                    let midpoint = {
                        x: (lm_filtered[1].x + lm_filtered[2].x) / 2,
                        y: (lm_filtered[1].y + lm_filtered[2].y) / 2
                    };
                    canvasCtx.beginPath();
                    canvasCtx.arc(midpoint.x * canvasElement.width, midpoint.y * canvasElement.height, 10, 0, 2 * Math.PI);
                    canvasCtx.fillStyle = "rgba(0, 255, 0, 0.5)";
                    canvasCtx.fill();  
                }
                
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
        selectCamera();
    })

    onDestroy(() => {
        cleanup();
    });
</script>

<div>
    {#if !isReady}
        <select name="cameras" id="cameras" bind:value={selectedCamera} onchange={selectCamera}>
            {#each cameras as camera}
                <option value={camera.deviceId}>{camera.label}</option>
            {/each}
        </select>
        <!-- svelte-ignore a11y_consider_explicit_label -->
        <button onclick={init}>起動</button>
    {:else}
        <!-- svelte-ignore a11y_media_has_caption -->
    <video width="640" height="480" bind:this={videoElement} autoplay muted playsinline 
        style="display: none;">
    </video>
    <canvas width="640" height="480" bind:this={canvasElement}></canvas>

    <input type="number" bind:value={THRESHOLD} min="0" max="10" step="0.1" />
    <p>{result}</p>
    {/if}
</div>