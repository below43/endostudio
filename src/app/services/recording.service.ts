import { ElementRef, EventEmitter, Injectable } from '@angular/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { getLocalIsoTimestamp } from 'local-iso-timestamp';
import { FilesystemService } from './filesystem.service';

@Injectable({
	providedIn: 'root'
})
export class RecordingService
{
	private sessionName: string = '';
	private mediaRecorder: MediaRecorder | undefined;
	private recordedChunks: Blob[] = [];
	private mimeType: string = '';
	
	public saving = new EventEmitter<boolean>();
	
	constructor() { }

	async startRecording(sessionName: string, stream: MediaStream)
	{
		this.SetSessionName(sessionName);

		const supportedMimeTypes = [
			'video/mp4',
			'video/webm',
			'video/ogg',
			'video/avi',
			'video/mov'
		];

		this.mimeType = supportedMimeTypes.find(mimeType => MediaRecorder.isTypeSupported(mimeType)) || '';

		if (!this.mimeType)
		{
			throw new Error('No supported video MIME types found');
		}

		const options = { mimeType: this.mimeType };
		this.recordedChunks = [];
		this.mediaRecorder = new MediaRecorder(stream, options);

		this.mediaRecorder.addEventListener('dataavailable', async (e) =>
		{
			if (e.data.size > 0)
			{
				if (Capacitor.isNativePlatform())
				{
					const chunk = e.data;
					const base64String = await this.blobToBase64(chunk);
					const sessionSafeName = this.getSafeSessionName();
					const fileCount = this.getSessionFileCount();

					await Filesystem.writeFile({
						path: `${sessionSafeName}/${sessionSafeName}.${fileCount}.${this.mimeType.split('/')[1]}`,
						directory: Directory.Documents,
						data: base64String,
						recursive: true
					});
				}
				else
				{
					this.recordedChunks.push(e.data);
				}
			}
		});

		this.mediaRecorder.addEventListener('stop', () =>
		{
			if (this.recordedChunks.length === 0)
			{
				this.saving.next(false);
				return;
			}
			if (!Capacitor.isNativePlatform())
			{
				this.saveRecording();
			}
		});

		this.mediaRecorder.start();
	}

	stopRecording()
	{
		if (this.mediaRecorder)
		{
			this.mediaRecorder.stop();
		}
	}

	async saveRecording()
	{
		const blob = new Blob(this.recordedChunks, { type: this.mimeType });
		const sessionSafeName = this.getSafeSessionName();
		const fileCount = this.getSessionFileCount();
		const fileExtension = this.mimeType.split('/')[1];

		if (Capacitor.isNativePlatform())
		{
			const base64String = await this.blobToBase64(blob);
			await Filesystem.writeFile({
				path: `${sessionSafeName}/${sessionSafeName}.${fileCount}.${fileExtension}`,
				directory: Directory.Documents,
				data: base64String,
				recursive: true
			});
		}
		else
		{
			const videoUrl = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = videoUrl;
			link.setAttribute('download', `${sessionSafeName}.${fileCount}.${fileExtension}`);
			document.body.appendChild(link);
			link.click();
		}

		this.saving.next(false);
	}

	private async blobToBase64(blob: Blob): Promise<string>
	{
		return new Promise((resolve, reject) =>
		{
			const reader = new FileReader();
			reader.onerror = (e) => reject(e);
			reader.onloadend = (e) =>
			{
				const dataUrl = reader.result as string;
				const base64 = dataUrl.substring(dataUrl.indexOf(',') + 1);
				resolve(base64);
			};
			reader.readAsDataURL(blob);
		});
	}

	private pad(n: number)
	{
		return (n < 10 ? '0' : '') + n;
	}

	private getSafeSessionName(): string
	{
		return this.sessionName.replace(/[^a-z0-9- ]/gi, '_');
	}

	SetSessionName(sessionName: string)
	{
		if (this.sessionName != sessionName)
		{
			this.sessionName = sessionName;
			this.resetSessionFileCounter();
		}
	}


	sessionFileCounter: number = 0;
	async resetSessionFileCounter(): Promise<void>
	{
		//if native, see if the directory exists
		if (Capacitor.isNativePlatform())
		{
			const sessionSafeName = this.getSafeSessionName();
			try
			{
				await Filesystem.stat({
					path: sessionSafeName,
					directory: Directory.Documents
				});

				await Filesystem.readdir({
					path: sessionSafeName,
					directory: Directory.Documents
				}).then(response => {
					this.sessionFileCounter = response.files.length;
				});
			}
			catch (e)
			{
				//if the directory doesn't exist, create it
				await Filesystem.mkdir({
					path: sessionSafeName,
					directory: Directory.Documents,
					recursive: true
				});
			}
		}
		//reset the counter
		this.sessionFileCounter = 0;
	}

	getSessionFileCount(): string
	{
		this.sessionFileCounter++;
		return this.sessionFileCounter.toString().padStart(3, '0');
	}

	async takePhoto(stream: MediaStream, video: any, canvas: HTMLCanvasElement, photo: HTMLImageElement, width: number, height: number, watermark: HTMLImageElement)
	{
		if (!stream)
		{
			throw new Error('Please select a camera first');
		}

		const context = canvas.getContext("2d");
		if (width && height && context)
		{
			canvas.width = width;
			canvas.height = height;
			context.drawImage(video, 0, 0, width, height);
			context.globalAlpha = 0.5; // Set the opacity to 0.5
			context.drawImage(watermark, 20, 20, watermark.width, watermark.height); // Draw at top left with some padding
			// context.drawImage(watermark, canvas.width - watermark.width - 10, 18, watermark.width, watermark.height);
			context.globalAlpha = 1.0; // Reset the opacity to 1.0 for other drawings

			const dataUrl = canvas.toDataURL("image/jpeg");
			const base64Data = dataUrl.split(',')[1]; // Extract the Base64 part

			const sessionSafeName = this.getSafeSessionName();
			const fileCount = this.getSessionFileCount();

			if (Capacitor.isNativePlatform())
			{
				await Filesystem.writeFile({
					path: `${sessionSafeName}/${sessionSafeName}.${fileCount}.jpeg`,
					directory: Directory.Documents,
					data: base64Data,
					recursive: true
				});
			} else
			{
				photo.setAttribute("src", dataUrl);

				// Create a link and associate the video URL
				const link = document.createElement('a');
				link.href = dataUrl;

				// Set the link to be downloadable
				link.setAttribute('download', `${sessionSafeName}.${fileCount}.jpeg`);

				// Add the link to the DOM
				document.body.appendChild(link);

				// Click the link
				link.click();
			}

			this.saving.next(false);
		}
		else
		{
			this.clearphoto(canvas, photo);
		}
	}

	clearphoto(canvas: HTMLCanvasElement, photo: HTMLImageElement)
	{
		const context = canvas.getContext("2d");
		if (context)
		{
			context.fillStyle = "#AAA";
			context.fillRect(0, 0, canvas.width, canvas.height);

			const data = canvas.toDataURL("image/png");
			photo.setAttribute("src", data);
		}
	}

}