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
import { RecordingService } from 'src/app/services/recording.service';

@Component({
	selector: 'app-home',
	templateUrl: 'home.page.html',
	styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit, AfterViewInit
{
	@ViewChild('videoElement') videoElement!: ElementRef;

	constructor(
		private toastController: ToastController,
		private cameraService: CameraService,
		private filesystemService: FilesystemService,
		private alertController: AlertController,
		private storageService: StorageService,
		private recordingService: RecordingService,
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

		this.recordingService.saving.subscribe(saving =>
		{
			this.saving = saving;
		});
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
				await this.alertController.create({
					header: 'No USB camera found',
					message: 'Please check that you have a USB camera connected and that you have given the app permission to use the camera in the app settings',
					buttons: ['OK']
				}).then(alert => alert.present());
			}
		}
		catch (err)
		{
			console.error('Error getting USB devices:', err);
		}

		try
		{
			if (this.audioDevices.length)
			{
				this.selectedMicrophone = this.audioDevices[0].deviceId;
			}
			else 
			{
				await this.alertController.create({
					header: 'No microphone found',
					message: 'Please check that you have a microphone connected and that you have given the app permission to use the microphone in the app settings',
					buttons: ['OK']
				}).then(alert => alert.present());
			}
		}
		catch (err)
		{
			console.error('Error getting microphones:', err);
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

	streaming: boolean = false;

	width: number = 1024;
	height: number = 768;

	canvas: HTMLCanvasElement | undefined;
	photo: HTMLImageElement | undefined;
	video: ElementRef<any> | undefined;
	watermark: HTMLImageElement | undefined;

	attachVideo(stream: MediaStream)
	{
		this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
		this.photo = document.getElementById('photo') as HTMLImageElement;
		this.watermark = document.getElementById('watermark') as HTMLImageElement;
		this.video = this.videoElement.nativeElement;

		this.cameraService.attachVideo(stream, this.videoElement.nativeElement, this.canvas, this.photo, this.width);
	}

	recording: boolean = false;
	saving: boolean = false;
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
			if (self.recordingStart && self.recording)
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

		this.recordingService.startRecording(this.session, this.stream);
	}

	pad(n: number)
	{
		return (n < 10 ? '0' : '') + n;
	}

	stopRecording()
	{
		this.recording = false;
		this.recordingService.stopRecording();
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

		if (!this.video || !this.canvas || !this.photo || !this.watermark)
		{
			this.presentToast('Please select a camera first');
			return;
		}
		else 
		{
			this.recordingService.takePhoto(this.stream, this.video, this.canvas, this.photo, this.width, this.height, this.watermark);
		}
	}

	session: string = '';

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
			this.recordingService.SetSessionName(this.session);
		}
	}

	toggleFullscreen()
	{
		//if native, toggle zoom
		if (Capacitor.isNativePlatform())
		{
			this.toggleZoom();
			return;
		}

		this.cameraService.toggleFullscreen();
	}

	toggleZoom()
	{
		this.zoom = !this.zoom
	}

	checkPermissions()
	{

	}
}
