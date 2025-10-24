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