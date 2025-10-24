# Endo Studio
EndoStudio is an app for viewing and recording video input from endoscopes and borescopes.

[Website](https://endostudio.app)

[iPadOS App](https://apps.apple.com/app/endostudio/id6736820920)

[PWA/Web App](https://web.endostudio.app)

## Source
[GitHub](https://github.com/below43/endo-studio)

## Trademarks
EndoStudio and associated logos are a trademark of Below 43 Ltd.

## License
This project's source code is released under the [MIT License](/LICENSE), with the following clarifications and restrictions:

**What IS covered by the MIT License:**
- The source code published in this repository
- Personal, internal, and commercial use of the code
- Modification and redistribution of the source code

**What is NOT covered by the MIT License:**
- The "EndoStudio" name, logo, branding, and visual assets
- The official EndoStudio app distributed on app stores
- App Store listings and compiled binaries

**Restrictions on Distribution:**
- You may freely use, modify, and redistribute the source code under the MIT License
- You **may not distribute** compiled versions of the app (e.g., on app stores or marketplaces) under the EndoStudio name, logo, or branding without explicit permission from Below 43 Ltd
- Publishing unmodified or minimally modified versions to app stores is prohibited - significant modifications and rebranding are required for app store distribution
- Please retain attribution to the original project when using this code

**Enterprise/Whitelabel Licensing:**
- For commercial whitelabel editions, enterprise licensing, or branding permissions, contact: enterprise@endostudio.app

## Running the app
EndoStudio is built on top of [Ionic Framework](https://ionicframework.com/) and [Capacitor](https://capacitorjs.com/).

### Initial setup
Install the Ionic CLI with npm:
`npm install -g @ionic/cli`
`npm install`

Note: If there was a previous installation of the Ionic CLI, it will need to be uninstalled due to a change in package name.
`npm uninstall -g ionic`
`npm install -g @ionic/cli`

### Run the app
```
ionic serve --configuration=development
```

or to run as dev with ssl:
```
ionic serve --configuration=development -b --ssl --external --disableHostCheck
```

or for http:
```
ionic serve --configuration=development -b --external --disableHostCheck
```

or with live reload:
```
ionic capacitor run  --livereload
```

### SSL Cert

Generate a self-signed cert 
`ionic ssl generate`

See also: https://ionicframework.com/docs/developing/previewing

### Proxy
To stop CORS errors, add the following environment variable to your dev machine
`export IONIC_HTTP_PROXY="https://localhost:7280"`