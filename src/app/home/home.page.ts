import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { AlertInput, ToastController } from '@ionic/angular';

@Component({
	selector: 'app-home',
	templateUrl: 'home.page.html',
	styleUrls: ['home.page.scss'],
})
export class HomePage implements AfterViewInit
{
	@ViewChild('videoElement') videoElement!: ElementRef;


	constructor(
		private toastController: ToastController
	) { }

	devices: MediaDeviceInfo[] = [];
	audioDevices: MediaDeviceInfo[] = [];

	selectedDevice: string = '';
	selectedMicrophone: string = '';

	sessionAlertInputs: AlertInput[] | undefined;
	isSessionAlertOpen: boolean = false;
	isAboutOpen: boolean = false;

	ngAfterViewInit(): void
	{
		this.getDevices();

		//session name with date and time and time zone in current locale, removing T and Z, and removing milliseconds and seconds
		this.session = 'EndoStudio ' + new Date().toISOString().replace('T', ' ').split('.')[0].split(':')[0] + ':' + new Date().toISOString().replace('Z', '').split('.')[0].split(':')[1];

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
		await navigator.mediaDevices.getUserMedia({ video: true, audio: true })

		console.log('getDevices called');
		const devices = await navigator.mediaDevices.enumerateDevices();
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
			console.log('refreshing devices');
			this.getDevices();
			return;
		}
		this.selectedDevice = event.detail.value;
		this.startCamera();
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
			this.stream = await navigator.mediaDevices.getUserMedia(constraints);
			this.attachVideo(this.stream);
		} catch (err)
		{
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
	async startRecording() 
	{
		if (this.stream == undefined)
		{
			alert('Please select a camera first');
			return;
		}
		console.log('start recording called');
		this.recording = true;
		this.presentToast('Recording started');
		const options = { mimeType: 'video/webm' };
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

			const blob = new Blob(self.recordedChunks, { type: 'video/webm' });

			//generate video url from blob
			const videoUrl = window.URL.createObjectURL(blob);

			//create a link and associate the video url
			const link = document.createElement('a');
			link.href = videoUrl;

			//set the link to be downloadable
			link.setAttribute('download', `${self.session}.webm`);

			//add the link to the DOM
			document.body.appendChild(link);

			//click the link
			link.click();

			self.saving = false;
			self.presentToast('Recording saved');
		});

		this.mediaRecorder.start();
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
			position: 'middle',
			mode: 'ios',
			translucent: true

		});
		toast.present();
	}



	takePhoto()
	{
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
