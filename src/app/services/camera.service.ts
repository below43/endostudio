import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class CameraService
{

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
		videoElement.srcObject = stream;
		videoElement.play();
		videoElement.muted = true;

		videoElement.addEventListener(
			"canplay",
			() =>
			{
				const videoHeight = (videoElement.videoHeight / videoElement.videoWidth) * width;
				canvas.setAttribute("width", width.toString());
				canvas.setAttribute("height", videoHeight.toString());

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
}