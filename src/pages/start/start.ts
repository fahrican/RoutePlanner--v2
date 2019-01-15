import {ClientsProvider} from './../../providers/clients/clients';
import {InfoPage} from './../info/info';
import {AngularFireAuth} from 'angularfire2/auth';
import {Component, ViewChild, ElementRef} from '@angular/core';
import {
    IonicPage,
    NavController,
    NavParams,
    AlertController,
    ToastController,
    Events,
    ModalController
} from 'ionic-angular';
import {Geolocation} from '@ionic-native/geolocation';
import firebase from 'firebase';
import moment from 'moment';
import {CustomAlertMessage} from "../../model/customAlertMessage";
import {StyledMap} from "../../model/styledMap";

//what does google do?
declare let google;
let infoWindow: any;
let service: any;


@IonicPage()
@Component({
    selector: 'start-home',
    templateUrl: 'start.html',
})
export class StartPage {

    public client = {
        title: '',
        location: null,
        address: null,
        placeId: null,
        extra_info: null,
        timestamp: undefined,
        docId: null,
        time_chosen: 1515283200,
        time_half: 1515283200,
        interval: null,
    };

    userId: any;
    geocoder = new google.maps.Geocoder();
    db = firebase.firestore();

    @ViewChild('map') mapElement: ElementRef;
    public map: any;
    autocomplete: { input: string; };
    GoogleAutocomplete: any;
    autocompleteItems: any[];
    zone: any;
    markers: any[];
    todayDateObj: Date;
    private customAlertMsg: CustomAlertMessage;

    constructor(public navCtrl: NavController, private afAuth: AngularFireAuth,
                public geolocation: Geolocation, public navParams: NavParams,
                private alertCtrl: AlertController,
                public clientsProvider: ClientsProvider,
                private toastCtrl: ToastController,
                public events: Events, public modalCtrl: ModalController) {

        this.todayDateObj = new Date();
        this.navCtrl = navCtrl;
        events.subscribe('client:deleted', client => this.loadMap());

        this.GoogleAutocomplete = new google.maps.places.AutocompleteService();
        this.autocomplete = {input: ''};
        this.autocompleteItems = [];
        this.geocoder = new google.maps.Geocoder;
        this.markers = [];
        this.customAlertMsg = new CustomAlertMessage(this.alertCtrl);
    }

    ionViewDidLoad() {
        this.loadMap();
        //Alternative Searchbox von Google - aktuell nicht verwendet !
        /*  let elem = <HTMLInputElement>document.getElementsByClassName('searchbar-input')[0];
         this.autocomplete = new google.maps.places.SearchBox(elem); */
    }

    saveClient() {
        this.clientsProvider.add(this.client).then(res => {
            let toast = this.toastCtrl.create({
                message: 'Client added !',
                duration: 2000
            });
            toast.present();
        })
    }

    updateSearchResults() {
        if (this.autocomplete.input === '') {
            this.autocompleteItems = [];
            return;
        }
        this.showUserPlacePrediction();
    }

    /**
     * Sets a marker on maps when user clicks on 'Add Client'.
     * @param item suggested address from search bar
     */
    selectSearchResult(item) {
        this.markers = [];
        this.autocompleteItems = [];
        this.geocoder
            .geocode({'placeId': item.place_id}, (results, status) => {
                if (status === 'OK' && results[0]) {

                    let address = this.setClientAttributes(results, item);
                    let marker = this.createMarkerOnGoogleMaps(results, item);
                    console.log('selectSearchResult results:', results);
                    this.saveClient();
                    let infoWindow = this.createClientInfoWindow(address, this.client.title);
                    this.addListenerOnGoogleMaps(infoWindow, marker, this.client.placeId);
                    this.markers.push(marker);
                    this.map.setCenter(results[0].geometry.location);
                }
            })
    }

    pushButton() {
        let modalCtrl = this.modalCtrl;
        let modal = modalCtrl.create(InfoPage);
        modal.present();
        this.loadMap();
    };

    markerLoad(placeId) {

        let lat;
        let lng;
        let clientsProvider = this.clientsProvider;

        this.afAuth.authState.subscribe(user => {
                if (user) {
                    this.userId = user.uid;
                }
                this.db.collection(user.uid).where("placeId", "==", placeId)
                    .get()
                    .then(function (querySnapshot) {
                        querySnapshot
                            .forEach(doc => this.setClientData(doc, lat, lng, clientsProvider))
                    })
            }
        );
        this.pushButton();
    }

    createListMarkers() {

        this.afAuth.authState.subscribe(user => {
            if (user) {
                this.userId = user.uid;
            }

            this.db.collection(user.uid).get().then(docs => {
                docs.forEach(coordinate => {
                    const title = coordinate.data().title;
                    const address = coordinate.data().adress;
                    const placeId = coordinate.data().placeId;
                    let marker_color = 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png';
                    const position = new google.maps.LatLng(coordinate.data().location._lat, coordinate.data().location._long);
                    console.log("createListMarkers position: ", position);
                    let infoWindow = this.createClientInfoWindow(address, title);

                    const marker = new google.maps.Marker({
                        position,
                        map: this.map,
                        icon: marker_color,
                        title: title,
                        animation: google.maps.Animation.DROP,
                    });
                    //const marker = this.createMarkerOnGoogleMaps(position, title);

                    this.addListenerOnGoogleMaps(infoWindow, marker, placeId);
                })
            })
        });
    }

    loadMap() {
        this.geolocation.getCurrentPosition().then(position => {
            let mapOptions = this.createMapOptions(position);
            let styledMapType = StyledMap.createStyledMap();
            this.map = new google.maps.Map(this.mapElement.nativeElement, mapOptions);
            this.map.mapTypes.set('styled_map', styledMapType);
            this.map.setMapTypeId('styled_map');
            this.createListMarkers();
        }, err => this.customAlertMsg.errorAlert(err.error));
    }

    /**
     *
     */
    private showUserPlacePrediction() {
        this.GoogleAutocomplete
            .getPlacePredictions({
                input: this.autocomplete.input
            }, (predictions, status) => {
                this.autocompleteItems = [];
                if (predictions !== null) {
                    predictions.forEach(
                        prediction => this.autocompleteItems.push(prediction)
                    )
                }
            });
    }

    /**
     * Sets listener on google maps.
     * @param infoWindow
     * @param marker
     * @param placeId
     */
    private addListenerOnGoogleMaps(infoWindow, marker, placeId) {

        google.maps.event
            .addListenerOnce(infoWindow, 'domready', () => {
                document.getElementById('myid')
                    .addEventListener('click', () => this.markerLoad(placeId));
            });

        google.maps.event
            .addListener(marker, 'click', () => infoWindow.open(this.map, this));
    }

    /**
     *
     * @param address contains street, number and city
     * @returns {google.maps.InfoWindow}
     */
    private createClientInfoWindow(address, title) {
        return new google.maps.InfoWindow({
            content: '<div><strong>' + title + '</strong><br>' +
                'Address: ' + address + '<br>' + '</div>' + '<button id="myid"><strong>Show Client Info !</strong></button>',
            maxWidth: 300
        });
    }

    /**
     * Creates a blue marker on Google Maps for selected item.
     * @param results Google shows a list of found addresses for input
     * @param item is the specific found address
     * @returns {google.maps.Marker}
     */
    private createMarkerOnGoogleMaps(results, item) {
        return new google.maps.Marker({
            map: this.map,
            position: results[0].geometry.location,
            animation: google.maps.Animation.DROP,
            title: item.description,
            icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
        });
    }

    private setClientAttributes(results, item) {

        let lat = results[0].geometry.location.lat();
        let lng = results[0].geometry.location.lng();
        this.client.location = new firebase.firestore.GeoPoint(lat, lng);
        this.client.title = item.description;
        this.client.timestamp = moment(this.todayDateObj).toDate();
        let address;
        let id;
        for (let i = 0; i < results.length; i++) {
            address = results[i].formatted_address;
            id = results[i].place_id;

        }
        this.client.address = address;
        this.client.placeId = id;
        return address;
    }

    private setClientData(doc, lat, lng, clientsProvider) {
        doc.data().location._lat = lat;
        doc.data().location._lng = lng;
        clientsProvider.clientData.info = doc.data().extra_info;
        clientsProvider.clientData.title = doc.data().title;
        clientsProvider.clientData.address = doc.data().address;
        clientsProvider.clientData.id = doc.data().placeId;
        clientsProvider.clientData.timestamp = doc.data().timestamp;
        clientsProvider.clientData.bool = true;
    }

    /**
     *
     * @param position
     * @return mapOptions
     */
    private createMapOptions(position) {

        let latLng = new google.maps
            .LatLng(position.coords.latitude, position.coords.longitude);

        let mapOptions = {
            center: latLng,
            zoom: 12,
            mapTypeId: google.maps.MapTypeId.TERRAIN,
            clickableIcons: false,
            disableDefaultUI: true,
            zoomControl: true,
            zoomControlOptions: {
                position: google.maps.ControlPosition.RIGHT_BOTTOM
            }
        };
        return mapOptions;
    }


}

// Nearby Search - Currently not used in App !!!
/* 
  searchMarker() {
    

   
    infoWindow = new google.maps.InfoWindow();
    var service = new google.maps.places.PlacesService(this.map);
    
    this.geolocation.getCurrentPosition().then((position) => {
    service.nearbySearch({
      
      location: {lat: position.coords.latitude, lng: position.coords.longitude}, 
      radius: 1000,
      type: ['store']
    }, (results,status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK) {
        for (var i = 0; i < results.length; i++) {
          this.createMarker(results[i]);
        }
      }
    });})
  }  */


/*  createMarker(client) {

  var image = {
    url: client.icon,
    size: new google.maps.Size(71, 71),
    origin: new google.maps.Point(0, 0),
    anchor: new google.maps.Point(17, 34),
    scaledSize: new google.maps.Size(25, 25)
  };

  var placeLoc = this.client.location;
  var marker = new google.maps.Marker({
    map: this.map,
    position: placeLoc,
    title: this.client.title
  });

  google.maps.event.addListener(marker, 'click', function() {
    infoWindow.setContent(this.client.title);
    infoWindow.open(this.map, this);
    infoWindow.setContent('<div><strong>' + this.client.title + '</strong><br>' );
  infoWindow.open(this.map, this);

  });
}   */


 







