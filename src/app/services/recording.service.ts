import { ElementRef, EventEmitter, Injectable } from '@angular/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { getLocalIsoTimestamp } from 'local-iso-timestamp';
import { FilesystemService } from './filesystem.service';
import { constants } from 'src/constants';
import { StorageService } from 'src/services/storage.service';
import { Media, MediaAlbum, MediaAlbumResponse, MediaSaveOptions } from '@capacitor-community/media';

export type SaveLocation = typeof constants.saveLocations.files | typeof constants.saveLocations.downloads | typeof constants.saveLocations.cameraRoll;

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

	constructor(
		public storageService: StorageService
	) { }

	async startRecording(sessionName: string, stream: MediaStream)
	{
		this.setSessionName(sessionName);

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

		const saveLocation = await this.getSaveLocation();
		
		if (saveLocation === constants.saveLocations.files)
		{
			//check permissions
			const permissions = await Filesystem.requestPermissions();
			if (permissions.publicStorage === 'denied')
			{
				throw new Error('Permission denied to save to public storage');
			}
		}

		if (Capacitor.isNativePlatform() && saveLocation === constants.saveLocations.cameraRoll)
		{
			const album = await this.createAlbum();
			if (!album)
			{
				throw new Error('Permission denied to save to camera roll');
			}
		}

		this.mediaRecorder.addEventListener('dataavailable', async (e) =>
		{
			if (e.data.size > 0)
			{
				if (Capacitor.isNativePlatform() && saveLocation === constants.saveLocations.files)
				{
					const chunk = e.data;
					const base64String = await this.blobToBase64(chunk);

					await Filesystem.writeFile({
						path: this.getCurrentFileNameAndPath(true),
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

			this.saveRecording();
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
		const saveLocation = await this.getSaveLocation();

		if (saveLocation === constants.saveLocations.files)
		{
			return; // the file should already be there...
		}

		console.log('saveRecording called', saveLocation);

		const blob = new Blob(this.recordedChunks, { type: this.mimeType });
		const fileName = this.getCurrentFileName();

		switch (saveLocation)
		{
			case constants.saveLocations.cameraRoll:
				const path = await this.blobToDataUrl(blob);
				const album = await this.createAlbum();
				let opts: MediaSaveOptions = { path, albumIdentifier: album?.identifier, fileName };
				await Media.saveVideo(opts);
				break;
			case constants.saveLocations.files:
				//do nothing as it should already be saved
				break;
			case constants.saveLocations.downloads:
			default:
				const videoUrl = window.URL.createObjectURL(blob);
				const link = document.createElement('a');
				link.href = videoUrl;
				link.setAttribute('download', fileName);
				document.body.appendChild(link);
				link.click();
				break;
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

	private async blobToDataUrl(blob: Blob): Promise<string>
	{
		return new Promise((resolve, reject) =>
		{
			const reader = new FileReader();
			reader.onloadend = () => resolve(reader.result as string);
			reader.onerror = reject;
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

	public setSessionName(sessionName: string)
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
				}).then(response =>
				{
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

	private async saveChunkToFileSystem(chunk: Blob)
	{
		const data = await this.blobToBase64(chunk);
		const path = this.getCurrentFileNameAndPath(true);

		await Filesystem.writeFile({
			path,
			directory: Directory.Documents,
			data,
			recursive: true
		});
	}

	private getSessionFileCount(incrementFileCount: boolean = false): string
	{
		if (incrementFileCount)
		{
			this.sessionFileCounter++;
		}
		return this.sessionFileCounter.toString().padStart(3, '0');
	}

	getCurrentFileNameAndPath(incrementFileCount: boolean = false): string
	{
		const sessionSafeName = this.getSafeSessionName();
		const fileName = this.getCurrentFileName(incrementFileCount);
		return `${sessionSafeName}/${fileName}`;
	}

	getCurrentFileName(incrementFileCount: boolean = false): string
	{
		const sessionSafeName = this.getSafeSessionName();
		const fileCount = this.getSessionFileCount(incrementFileCount);
		return `${sessionSafeName}.${fileCount}.${this.mimeType.split('/')[1]}`;
	}

	getCurrentImageFileNameAndPath(incrementFileCount: boolean = false): string
	{
		const sessionSafeName = this.getSafeSessionName();
		const fileName = this.getCurrentImageFileName(incrementFileCount);
		return `${sessionSafeName}/${fileName}`;
	}

	getCurrentImageFileName(incrementFileCount: boolean = false): string
	{
		const sessionSafeName = this.getSafeSessionName();
		const fileCount = this.getSessionFileCount(incrementFileCount);
		return `${sessionSafeName}.${fileCount}.jpeg`;
	}

	public async getSaveLocation(): Promise<SaveLocation>
	{
		let saveLocation = await this.storageService.getItem(constants.settings.saveLocation) as SaveLocation || constants.saveLocations.files;

		if (!saveLocation)
		{
			saveLocation = (Capacitor.isNativePlatform()) ? constants.saveLocations.files : constants.saveLocations.downloads;
		}

		return saveLocation;
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
			// context.globalAlpha = 0.5; // Set the opacity to 0.5
			// context.drawImage(watermark, 20, 20, watermark.width, watermark.height); // Draw at top left with some padding
			// context.globalAlpha = 1.0; // Reset the opacity to 1.0 for other drawings

			const dataUrl = canvas.toDataURL("image/jpeg");
			const base64Data = dataUrl.split(',')[1]; // Extract the Base64 part

			if (Capacitor.isNativePlatform())
			{
				const saveLocation = await this.getSaveLocation();

				switch (saveLocation)
				{
					case constants.saveLocations.cameraRoll:
						const album = await this.createAlbum();
						let opts: MediaSaveOptions = { path: dataUrl, albumIdentifier: album?.identifier };
						await Media.savePhoto(opts);
						break;
					case constants.saveLocations.files:
						const path = this.getCurrentImageFileNameAndPath(true);
						await Filesystem.writeFile({
							path,
							directory: Directory.Documents,
							data: base64Data,
							recursive: true
						});
						break;
				}
			}
			else
			{
				photo.setAttribute("src", dataUrl);

				// Create a link and associate the video URL
				const link = document.createElement('a');
				link.href = dataUrl;

				// Set the link to be downloadable
				const fileName = this.getCurrentImageFileName(true);
				link.setAttribute('download', fileName);

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

	async createAlbum(): Promise<MediaAlbum | undefined>
	{
		let album = await this.getAlbum();
		if (!album)
		{
			await Media.createAlbum({ name: this.sessionName });
			album = await this.getAlbum();
		}
		return album;
	}

	async getAlbum(): Promise<MediaAlbum | undefined>
	{
		const albums = await Media.getAlbums();
		const album = albums.albums.find(album => album.name === this.sessionName);
		console.log('album', album);
		return album;
	}
}