// Installed before expo-router loads the app, so errors thrown while the
// app's modules initialise are shown rather than closing the app.
import { installFatalErrorAlert } from './lib/fatalErrorAlert';

installFatalErrorAlert();

require('expo-router/entry');
