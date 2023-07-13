# Endo Studio

## initial setup
Install the Ionic CLI with npm:

`npm install -g @ionic/cli`
`npm install`

Note: If there was a previous installation of the Ionic CLI, it will need to be uninstalled due to a change in package name.
`npm uninstall -g ionic`
`npm install -g @ionic/cli`

## run the app
`ionic serve --configuration=development`

or to run as dev with ssl:
`ionic serve --configuration=development -b --ssl --external --disableHostCheck`

or for http:
`ionic serve --configuration=development -b --external --disableHostCheck`

or with live reload:
`ionic capacitor run  --livereload`

## SSL Cert

Generate a self-signed cert 
`ionic ssl generate`


See also: https://ionicframework.com/docs/developing/previewing

## Proxy
To stop CORS errors, add the following environment variable to your dev machine
`export IONIC_HTTP_PROXY="https://localhost:7280"`

# License
[MIT License](/LICENSE)