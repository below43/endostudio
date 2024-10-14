import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { AlertController, AlertInput, ToastController } from '@ionic/angular';
import { CameraService } from 'src/app/services/camera.service';
import { FilesystemService } from 'src/app/services/filesystem.service';
import { environment } from 'src/environments/environment';
import { version } from 'src/environments/version';
import { Capacitor } from '@capacitor/core';
import { StorageService } from 'src/services/storage.service';
import { App } from '@capacitor/app';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { getLocalIsoTimestamp } from 'local-iso-timestamp';

@Component({
	selector: 'app-home',
	templateUrl: 'home.page.html',
	styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit, AfterViewInit
{
	@ViewChild('videoElement') videoElement!: ElementRef;
	mimeType: string = '';

	constructor(
		private toastController: ToastController,
		private cameraService: CameraService,
		private filesystemService: FilesystemService,
		private alertController: AlertController,
		private storageService: StorageService,
	) { }

	devices: MediaDeviceInfo[] = [];
	audioDevices: MediaDeviceInfo[] = [];

	selectedDevice: string = '';
	selectedMicrophone: string = '';

	sessionAlertInputs: AlertInput[] | undefined;
	isSessionAlertOpen: boolean = false;
	isAboutOpen: boolean = false;
	zoom: boolean = true;

	appEnvironment = environment;
	appVersion = version;


	ngOnInit()
	{
		if (this.selectedDevice) this.startCamera();
		this.initialiseAsync();
	}

	async initialiseAsync()
	{
		const agreed = await this.storageService.getItem('agreedToTerms');
		if (!agreed)
		{
			this.showDisclaimerAlert();
		}
	}

	async showDisclaimerAlert()
	{
		const alert = await this.alertController.create({
			header: 'Disclaimer',
			message: `${environment.productName} is not intended for medical use. ${environment.creator} is not liable for any misuse of the app, including but not limited to any loss of life or injury resulting from its use. Users are responsible for ensuring that the app is used in a safe and appropriate manner.
				  <br/><br/>THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`,
			buttons: [
				{
					text: 'Disagree',
					role: 'cancel',
					handler: () =>
					{
						//close the app
						if (Capacitor.isNativePlatform())	
						{
							App.exitApp();
						}
						else
						{
							//close the browser
							window.close();
						}
					}
				},
				{
					text: 'Agree',
					handler: async () =>
					{
						await this.storageService.setItem('agreedToTerms', true);
					}
				}
			]
		});

		await alert.present();
	}

	ngAfterViewInit(): void
	{
		//if native, check permissions on devices first
		if (Capacitor.isNativePlatform())
		{
			this.checkPermissions();
		}

		this.getDevices();

		//session name with date and time and time zone in current locale, removing T and Z, and removing milliseconds and seconds

		const localIsoTimestamp = getLocalIsoTimestamp();
		console.log('Local ISO timestamp:', localIsoTimestamp);

		this.session = this.appEnvironment.productName + ' ' + localIsoTimestamp.replace('T', ' ').split('.')[0].split(':')[0] + ':' + localIsoTimestamp.replace('Z', '').split('.')[0].split(':')[1];
		this.resetSessionFileCounter();

		//initialise the session name input
		this.sessionAlertInputs = [
			{
				placeholder: 'Session name',
				name: 'session',
				type: 'text',
				value: this.session,
			}
		];
	}

	async getDevices()
	{
		try
		{
			const devices = await this.cameraService.getDevices();
			console.log('Devices:', this.devices);
			this.devices = devices.filter(device => device.kind === 'videoinput');
			this.audioDevices = devices.filter(device => device.kind === 'audioinput');
			console.log('Available input and output devices:', this.devices);
		}
		catch (err)
		{
			console.error('Error getting devices:', err);
			const alert = this.alertController.create({
				header: 'Error getting devices',
				message: 'Please check that you have given the app permission to use the camera and microphone in the app settings',
				buttons: ['OK']
			}).then(alert => alert.present());
		}

		try
		{
			const usbDevices = this.devices.filter(device => device.label.toLowerCase().includes('usb'));
			if (usbDevices.length)
			{
				this.selectedDevice = usbDevices[0].deviceId;
			}
			else
			{
				this.selectedDevice = '';
				this.stopStreamTracks();
			}
		}
		catch (err)
		{
			console.error('Error getting USB devices:', err);
			await this.alertController.create({
				header: 'No USB camera found',
				message: 'Please check that you have a USB camera connected and that you have given the app permission to use the camera in the app settings',
				buttons: ['OK']
			}).then(alert => alert.present());
		}

		try
		{
			if (this.audioDevices.length)
			{
				this.selectedMicrophone = this.audioDevices[0].deviceId;
			}
		}
		catch (err)
		{
			console.error('Error getting microphones:', err);
			await this.alertController.create({
				header: 'No microphone found',
				message: 'Please check that you have a microphone connected and that you have given the app permission to use the microphone in the app settings',
				buttons: ['OK']
			}).then(alert => alert.present());
		}

		if (this.selectedDevice)
		{
			this.startCamera();
		}
	}

	startCamera()
	{
		this.start(this.selectedDevice);
	}


	selectCamera()
	{
		var selector = document.getElementById('ion-select-device');
		if (selector) selector.click();
	}

	deviceSelected(event: any)
	{
		if (event.detail.role == 'cancel') return;

		if (event.detail.value == 'refresh')
		{
			this.stopStreamTracks();

			this.getDevices();
			return;
		}
		this.selectedDevice = event.detail.value;
		this.startCamera();
	}

	async stopStreamTracks()
	{
		// Stop all tracks of the current stream
		if (this.stream)
		{
			this.stream.getTracks().forEach(track => track.stop());
			this.stream = undefined;
		}
	}

	selectMicrophone()
	{
		var selector = document.getElementById('ion-select-microphone');
		if (selector) selector.click();
	}

	microphoneSelected(event: any)
	{
		if (event.detail.role == 'cancel') return;

		let microphone = event.detail.value;
		if (microphone)
		{
			this.selectedMicrophone = microphone;
		}
		this.startCamera();
	}

	private stream: MediaStream | undefined;
	async start(deviceId: string)
	{
		var audio: any = undefined;
		if (!this.recordAudio)
		{
			audio = false;
		}
		else if (!this.selectedMicrophone)
		{
			audio = true;
		}
		else
		{
			audio = {
				deviceId: { exact: this.selectedMicrophone }
			}
		}

		const constraints = {
			video: {
				deviceId: { exact: deviceId }
			},
			audio
		};

		try
		{
			this.stream = await this.cameraService.getUserMedia(constraints);
			this.attachVideo(this.stream);
		} catch (err)
		{
			this.presentToast('Error attaching video. ' + err + '');
			this.handleError(err);
		}
	}

	handleError(error: any)
	{
		console.log('Error: ', error);
	}

	video: any;
	canvas: any;
	photo: any;
	streaming: boolean = false;

	width: number = 1024;
	height: number = 768;

	attachVideo(stream: MediaStream)
	{
		this.videoElement.nativeElement.srcObject = stream;
		this.videoElement.nativeElement.play();
		this.videoElement.nativeElement.muted = true;

		this.video = this.videoElement.nativeElement;
		this.canvas = document.getElementById('canvas');
		this.photo = document.getElementById('photo');
		this.videoElement.nativeElement.addEventListener(
			"canplay",
			(ev: any) =>
			{
				if (!this.streaming)
				{
					this.height = (this.video.videoHeight / this.video.videoWidth) * this.width;
					this.canvas.setAttribute("width", this.width);
					this.canvas.setAttribute("height", this.height);
					this.streaming = true;
				}
			},
			false,
		);
		this.clearphoto();
	}

	recording: boolean = false;
	saving: boolean = false;
	mediaRecorder: MediaRecorder | undefined;
	recordedChunks: Blob[] = [];
	recordAudio: boolean = true;
	recordingStart: Date | undefined;
	recordingTime: string = '00:00:00';
	async startRecording()
	{
		if (this.stream == undefined)
		{
			await this.presentToast('Please select a camera first');
			return;
		}
		console.log('start recording called');
		this.recording = true;
		//start recording time - we want to count upwards in seconds eg. 00:10:30
		this.recordingStart = new Date();
		//set recordingTime to 00:00:00
		this.recordingTime = '00:00:00';
		//now count up every second
		var self = this;
		setInterval(function ()
		{
			if (self.recordingStart)
			{
				var now = new Date();
				var diff = now.getTime() - self.recordingStart.getTime();
				var seconds = Math.floor(diff / 1000);
				var minutes = Math.floor(seconds / 60);
				var hours = Math.floor(minutes / 60);
				seconds = seconds % 60;
				minutes = minutes % 60;
				hours = hours % 60;
				self.recordingTime = self.pad(hours) + ":" + self.pad(minutes) + ":" + self.pad(seconds);
			}
		}, 1000);

		if (MediaRecorder.isTypeSupported('video/mp4'))
		{
			this.mimeType = 'video/mp4';
		}
		else if (MediaRecorder.isTypeSupported('video/webm'))
		{
			this.mimeType = 'video/webm';
		}
		else
		{
			this.presentToast('No supported video MIME types found');
			return;
		}
		const options = { mimeType: this.mimeType };

		this.presentToast('Recording started');
		this.recordedChunks = [];
		this.mediaRecorder = new MediaRecorder(this.stream, options);

		var self = this;
		this.mediaRecorder.addEventListener('dataavailable', function (e)
		{
			console.log('data available called');
			if (e.data.size > 0)
			{
				self.recordedChunks.push(e.data);
			}

			// if (self.recording === false)
			// {
			// 	if (self.mediaRecorder != undefined) self.mediaRecorder.stop();
			// }
		});

		this.mediaRecorder.addEventListener('stop', function ()
		{
			console.log('stop called');
			if (self.recordedChunks.length == 0)
			{
				console.log('no data to save');
				self.saving = false;
				return;
			}
			self.saveRecording();
		});

		this.mediaRecorder.start();
	}

	pad(n: number)
	{
		return (n < 10 ? '0' : '') + n;
	}

	stopRecording()
	{
		this.recording = false;

		if (this.mediaRecorder != undefined)
		{
			this.saving = true;
			this.mediaRecorder.stop();
		}
	}

	async saveRecording()
	{
		const blob = new Blob(this.recordedChunks, { type: this.mimeType });

		//set the link to be downloadable
		let fileExtension = '';
		if (this.mimeType == 'video/mp4' || this.mimeType.startsWith('video/mp4'))
		{
			fileExtension = 'mp4';
		}
		else if (this.mimeType == 'video/webm')
		{
			fileExtension = 'webm';
		}
		else
		{
			fileExtension = 'err';
		}


		//make session name a safe directory/filename
		const sessionSafeName = this.getSafeSessionName();

		const fileCount = this.getSessionFileCount();

		//if native
		if (Capacitor.isNativePlatform())
		{
			const base64String = await this.blobToBase64V2(blob);

			await Filesystem.mkdir({
				path: environment.productName,
				directory: Directory.Documents,
				recursive: true
			});

			await Filesystem.writeFile({
				path: `${sessionSafeName}/${sessionSafeName}.${fileCount}.${fileExtension}`,
				directory: Directory.Documents,
				data: base64String,
				recursive: true
			});

			/** See android documention if implementing for Android:  https://capacitorjs.com/docs/apis/filesystem#mkdiroptions */
		}
		else 
		{
			//generate video url from blob
			const videoUrl = window.URL.createObjectURL(blob);

			//create a link and associate the video url
			const link = document.createElement('a');
			link.href = videoUrl;
			link.setAttribute('download', `${sessionSafeName}.${fileCount}.${fileExtension}`);

			//add the link to the DOM
			document.body.appendChild(link);

			//click the link
			link.click();
		}

		this.saving = false;
		this.presentToast('Recording saved');
	}

	toggleMute()
	{
		if (this.recording)
		{
			this.presentToast('Cannot mute while recording');
			return;
		}
		this.recordAudio = !this.recordAudio;

		this.start(this.selectedDevice);

		//show iontoast with mute status
		this.presentToast('Microphone ' + (this.recordAudio ? 'unmuted' : 'muted'));
	}

	blobToBase64(blob: Blob): Promise<string>
	{
		return new Promise((resolve, reject) =>
		{
			const reader = new FileReader();
			reader.onloadend = () =>
			{
				if (reader.result)
				{
					resolve(reader.result as string);
				} else
				{
					reject(new Error("FileReader failed to convert blob to Base64"));
				}
			};
			reader.onerror = () =>
			{
				reject(new Error("FileReader encountered an error"));
			};
			reader.readAsDataURL(blob);
		});
	}

	private async blobToBase64V2(blob: Blob): Promise<string>
	{
		return new Promise((resolve, reject) =>
		{
			const reader = new FileReader();
			reader.onerror = (e) => reject(e);
			reader.onloadend = (e) =>
			{
				const dataUrl = reader.result as string;
				console.log('dataUrl:', dataUrl);
				const base64 = dataUrl.substring(dataUrl.indexOf(',') + 1);
				console.log('base64:', base64);
				resolve(base64);
			};
			reader.readAsDataURL(blob);
		});
	}

	async base64FromPath(path: string): Promise<string>
	{
		const response = await fetch(path);
		const blob = await response.blob();
		return new Promise((resolve, reject) =>
		{
			const reader = new FileReader();
			reader.onerror = reject;
			reader.onload = () =>
			{
				if (typeof reader.result === 'string')
				{
					resolve(reader.result);
				} else
				{
					reject('method did not return a string');
				}
			};
			reader.readAsDataURL(blob);
		});
	}

	async presentToast(message: string)
	{
		const toast = await this.toastController.create({
			message: message,
			duration: 2000,
			position: 'bottom',
			mode: 'ios',
			translucent: true

		});
		toast.present();
	}

	async takePhoto()
	{
		if (this.stream == undefined)
		{
			this.presentToast('Please select a camera first');
			return;
		}

		const context = this.canvas.getContext("2d");
		if (this.width && this.height)
		{
			this.canvas.width = this.width;
			this.canvas.height = this.height;
			context.drawImage(this.video, 0, 0, this.width, this.height);

			const dataUrl = this.canvas.toDataURL("image/jpeg");
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
			}
			else
			{
				this.photo.setAttribute("src", dataUrl);

				//create a link and associate the video url
				const link = document.createElement('a');
				link.href = dataUrl;

				//set the link to be downloadable
				link.setAttribute('download', `${sessionSafeName}.${fileCount}.jpeg`);

				//add the link to the DOM
				document.body.appendChild(link);

				//click the link
				link.click();
			}

			this.saving = false;
			this.presentToast('Image saved');
		}
		else
		{
			this.clearphoto();
		}
	}

	clearphoto()
	{
		const context = this.canvas.getContext("2d");
		context.fillStyle = "#AAA";
		context.fillRect(0, 0, this.canvas.width, this.canvas.height);

		const data = this.canvas.toDataURL("image/png");
		this.photo.setAttribute("src", data);
	}

	session: string = '';
	setSessionName()
	{

	}

	public alertButtons = [
		{
			text: 'Cancel',
			role: 'cancel',
			handler: () =>
			{

			},
		},
		{
			text: 'OK',
			role: 'confirm',
			handler: () =>
			{

			},
		},
	];

	setSessionNameResult(ev: any)
	{
		this.isSessionAlertOpen = false;
		console.log(ev);
		if (ev.detail.role == 'cancel') return;
		let session = ev.detail.data.values.session;
		if (session)
		{
			this.session = session.trim();
			this.resetSessionFileCounter();
		}
	}

	sessionFileCounter: number = 0;
	resetSessionFileCounter() {
		this.sessionFileCounter = 0;
	}

	getSessionFileCount(): string
	{
		this.sessionFileCounter++;
		return this.sessionFileCounter.toString().padStart(3, '0');
	}

	toggleFullscreen()
	{
		//if native, toggle zoom
		if (Capacitor.isNativePlatform())
		{
			this.toggleZoom();
			return;
		}
		if (!document.fullscreenElement)
		{
			document.documentElement.requestFullscreen();
		}
		else if (document.exitFullscreen)
		{
			document.exitFullscreen();
		}
	}

	toggleZoom()
	{
		this.zoom = !this.zoom
	}

	checkPermissions()
	{

	}

	getSafeSessionName(): string
	{
		return this.session.replace(/[^a-z0-9- ]/gi, '_');
	}
}
