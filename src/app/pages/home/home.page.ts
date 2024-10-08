import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { AlertInput, ToastController } from '@ionic/angular';
import { CameraService } from 'src/app/services/camera.service';
import { FilesystemService } from 'src/app/services/filesystem.service';
import { environment } from 'src/environments/environment';
import { version } from 'src/environments/version';

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
		private filesystemService: FilesystemService
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
	}
	
	ngAfterViewInit(): void
	{
		this.getDevices();

		//session name with date and time and time zone in current locale, removing T and Z, and removing milliseconds and seconds
		this.session = this.appEnvironment.productName + ' ' + new Date().toISOString().replace('T', ' ').split('.')[0].split(':')[0] + ':' + new Date().toISOString().replace('Z', '').split('.')[0].split(':')[1];

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

		const devices = await this.cameraService.getDevices();

		console.log('Devices:', this.devices);
		this.devices = devices.filter(device => device.kind === 'videoinput');
		this.audioDevices = devices.filter(device => device.kind === 'audioinput');
		console.log('Available input and output devices:', this.devices);

		//try to find USB camera
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

		if (this.audioDevices.length)
		{
			this.selectedMicrophone = this.audioDevices[0].deviceId;
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
		if (this.stream) {
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
			alert(err);
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
			alert('Please select a camera first');
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
			alert('No supported video MIME types found');
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

			const blob = new Blob(self.recordedChunks, { type: this.mimeType });

			//generate video url from blob
			const videoUrl = window.URL.createObjectURL(blob);

			//create a link and associate the video url
			const link = document.createElement('a');
			link.href = videoUrl;

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
			else {
				fileExtension = 'err';
			}
			link.setAttribute('download', `${self.session}.${fileExtension}`);

			//add the link to the DOM
			document.body.appendChild(link);

			//click the link
			link.click();

			self.saving = false;
			self.presentToast('Recording saved');
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

	toggleMute()
	{
		if (this.recording)
		{
			alert('Cannot mute while recording');
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

	takePhoto()
	{
		if (this.stream == undefined)
		{
			alert('Please select a camera first');
			return;
		}
		
		const context = this.canvas.getContext("2d");
		if (this.width && this.height)
		{
			this.canvas.width = this.width;
			this.canvas.height = this.height;
			context.drawImage(this.video, 0, 0, this.width, this.height);

			const data = this.canvas.toDataURL("image/jpeg");
			this.photo.setAttribute("src", data);

			//create a link and associate the video url
			const link = document.createElement('a');
			link.href = data;

			//set the link to be downloadable
			link.setAttribute('download', `${this.session}.jpg`);

			//add the link to the DOM
			document.body.appendChild(link);

			//click the link
			link.click();

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
		}
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
