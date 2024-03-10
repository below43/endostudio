import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class CameraService
{

	constructor() { }

	async getDevices(): Promise<MediaDeviceInfo[]>
	{
		await navigator.mediaDevices.getUserMedia({ video: true, audio: true })

		console.log('getDevices called');
		const devices = await navigator.mediaDevices.enumerateDevices();
		return devices;
	}
	
	async getUserMedia(constraints: { video: { deviceId: { exact: string; }; }; audio: any; }): Promise<MediaStream>
	{
		const stream = await navigator.mediaDevices.getUserMedia(constraints);
		return stream;
	}
}
