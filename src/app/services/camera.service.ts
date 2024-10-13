import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class CameraService
{

	constructor() { }

	async getDevices(): Promise<MediaDeviceInfo[]>
	{
		try
		{
			await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

			const devices = await navigator.mediaDevices.enumerateDevices();
			console.log('getDevices', devices);
			return devices;
		}
		catch (err)
		{
			console.error('Error getting user media:', err);
			throw err;
		}
	}

	async getUserMedia(constraints: { video: { deviceId: { exact: string; }; }; audio: any; }): Promise<MediaStream>
	{
		let stream;
		try
		{
			stream = await navigator.mediaDevices.getUserMedia(constraints);
		}
		catch (err)
		{
			console.error('Error getting user media with constraints:', err);
			throw err;
		}
		return stream;
	}
}