import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class CameraService
{
	private currentZoom: number = 1;
	private minZoom: number = 1; // Will be dynamically calculated to prevent zooming beyond natural boundaries
	private maxZoom: number = 3;
	private zoomStep: number = 0.1;
	private videoElement: HTMLVideoElement | null = null;

	constructor() { }

	async getDevices(): Promise<MediaDeviceInfo[]>
	{
		let devices;
		try
		{
			await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
			devices = await navigator.mediaDevices.enumerateDevices();
			console.log('getDevices', devices);
		}
		catch (err)
		{
			console.error('Error getting user media:', err);
			throw err;
		}
		return devices;
	}

	async getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>
	{
		let stream;
		try
		{
			stream = await navigator.mediaDevices.getUserMedia(constraints);
		}
		catch (err)
		{
			console.error('Error getting user media:', err);
			throw err;
		}
		return stream;
	}

	public attachVideo(stream: MediaStream, videoElement: HTMLVideoElement, canvas: HTMLCanvasElement, photo: HTMLImageElement, width: number)
	{
		this.videoElement = videoElement;
		videoElement.srcObject = stream;
		videoElement.play();
		videoElement.muted = true;
		
		// Set up zoom controls
		this.setupZoomControls(videoElement);

		// Recalculate min zoom on window resize
		window.addEventListener('resize', () => {
			this.calculateMinZoom();
		});

		videoElement.addEventListener(
			"canplay",
			() =>
			{
				const videoHeight = (videoElement.videoHeight / videoElement.videoWidth) * width;
				canvas.setAttribute("width", width.toString());
				canvas.setAttribute("height", videoHeight.toString());

				// Calculate minimum zoom to prevent zooming beyond natural boundaries
				this.calculateMinZoom();

				// Use requestAnimationFrame to keep the video element updated
				const updateVideo = () => {
					if (!videoElement.paused && !videoElement.ended) {
						videoElement.play();
						requestAnimationFrame(updateVideo);
					}
				};
				requestAnimationFrame(updateVideo);
			},
			false,
		);
		
		videoElement.addEventListener(
			"error",
			(err) => {
				console.error("Error with video element:", err);
				// Try reassigning the srcObject
				videoElement.srcObject = null;
				videoElement.srcObject = stream;
			},
			false
		);

		this.clearPhoto(canvas, photo);
	}

	clearPhoto(canvas: HTMLCanvasElement, photo: HTMLImageElement)
	{
		const context = canvas.getContext("2d");
		if (context === null) return;

		context.fillStyle = "#AAA";
		context.fillRect(0, 0, canvas.width, canvas.height);

		const data = canvas.toDataURL("image/png");
		photo.setAttribute("src", data);
	}

	toggleFullscreen()
	{
		if (!document.fullscreenElement)
		{
			document.documentElement.requestFullscreen();
		}
		else if (document.exitFullscreen)
		{
			document.exitFullscreen();
		}
	}

	// Zoom functionality
	private setupZoomControls(videoElement: HTMLVideoElement): void
	{
		// Reset zoom
		this.currentZoom = 1;
		this.applyZoom();

		// Keyboard zoom controls
		document.addEventListener('keydown', (event) => {
			if (event.key === '=' || event.key === '+') {
				event.preventDefault();
				this.zoomIn();
			} else if (event.key === '-') {
				event.preventDefault();
				this.zoomOut();
			}
		});

		// Touch/pinch zoom controls
		let initialDistance: number = 0;
		let initialZoom: number = 1;

		videoElement.addEventListener('touchstart', (event) => {
			if (event.touches.length === 2) {
				event.preventDefault();
				initialDistance = this.getTouchDistance(event.touches[0], event.touches[1]);
				initialZoom = this.currentZoom;
			}
		});

		videoElement.addEventListener('touchmove', (event) => {
			if (event.touches.length === 2) {
				event.preventDefault();
				const currentDistance = this.getTouchDistance(event.touches[0], event.touches[1]);
				const scale = currentDistance / initialDistance;
				const newZoom = initialZoom * scale;
				this.setZoom(newZoom);
			}
		});

		videoElement.addEventListener('touchend', (event) => {
			if (event.touches.length < 2) {
				initialDistance = 0;
			}
		});

		// Mouse wheel zoom (optional)
		videoElement.addEventListener('wheel', (event) => {
			event.preventDefault();
			if (event.deltaY < 0) {
				this.zoomIn();
			} else {
				this.zoomOut();
			}
		});
	}

	private getTouchDistance(touch1: Touch, touch2: Touch): number
	{
		const dx = touch1.clientX - touch2.clientX;
		const dy = touch1.clientY - touch2.clientY;
		return Math.sqrt(dx * dx + dy * dy);
	}

	private resetTransformOrigin(): void
	{
		if (this.videoElement) {
			this.videoElement.style.transformOrigin = 'center center';
		}
	}

	private calculateMinZoom(): void
	{
		if (!this.videoElement) return;

		const videoRect = this.videoElement.getBoundingClientRect();
		const parentElement = this.videoElement.parentElement;
		
		if (!parentElement) {
			this.minZoom = 1;
			return;
		}

		const parentRect = parentElement.getBoundingClientRect();
		
		// Calculate the minimum scale needed to fill the container
		// This ensures we never zoom out beyond the natural video boundaries
		const scaleX = parentRect.width / videoRect.width;
		const scaleY = parentRect.height / videoRect.height;
		
		// Use the larger scale to ensure the video always fills the container
		this.minZoom = Math.max(scaleX, scaleY, 1);
		
		// If current zoom is less than new minimum, adjust it
		if (this.currentZoom < this.minZoom) {
			this.currentZoom = this.minZoom;
			this.applyZoom();
		}
	}

	private applyZoom(): void
	{
		if (this.videoElement) {
			this.videoElement.style.transform = `scale(${this.currentZoom})`;
			this.videoElement.style.transformOrigin = 'center center';
		}
	}

	public zoomIn(): void
	{
		this.currentZoom = Math.min(this.currentZoom + this.zoomStep, this.maxZoom);
		this.applyZoom();
	}

	public zoomOut(): void
	{
		this.currentZoom = Math.max(this.currentZoom - this.zoomStep, this.minZoom);
		this.applyZoom();
	}

	public setZoom(zoom: number): void
	{
		this.currentZoom = Math.max(this.minZoom, Math.min(zoom, this.maxZoom));
		this.applyZoom();
	}

	public resetZoom(): void
	{
		this.currentZoom = 1;
		this.applyZoom();
	}

	public getCurrentZoom(): number
	{
		return this.currentZoom;
	}

	public getZoomLimits(): { min: number, max: number }
	{
		return { min: this.minZoom, max: this.maxZoom };
	}
}