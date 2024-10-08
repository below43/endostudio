import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';

@Injectable({
	providedIn: 'root'
})
export class StorageService
{

	//We use a storage service so we can add other stuff on top of storage keys if we see fit
	constructor(
		private storage: Storage,
		private toastController: ToastController
	)
	{
		this.initializeStorage();
	}

	async initializeStorage()
	{
		await this.storage.create().catch(() =>
		{
			this.toastController.create({
				message: 'Failed to initialize indexed db.',
				duration: 2000
			}).then(toast => toast.present());
		});
	}

	public setItem(key: string, value: any): Promise<any>
	{
		return this.storage.set(key, value);
	}

	public getItem(key: string): Promise<any>
	{
		return this.storage.get(key);
	}

	public clear(): Promise<void>
	{
		return this.storage.clear();
	}

	public remove(key: string): Promise<any>
	{
		return this.storage.remove(key);
	}
}
