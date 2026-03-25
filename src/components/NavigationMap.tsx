import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, Circle, InfoWindow } from '@react-google-maps/api';
import { motion } from 'motion/react';
import { Shelter, RegionData, RiskLevel } from '../types';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MapPin, Navigation, Shield, AlertTriangle, Home, Info } from 'lucide-react';
import { cn } from '../lib/utils';

const containerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: 23.6850,
  lng: 90.3563
};

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  styles: [
    {
      "elementType": "geometry",
      "stylers": [{ "color": "#151619" }]
    },
    {
      "elementType": "labels.text.fill",
      "stylers": [{ "color": "#8E9299" }]
    },
    {
      "elementType": "labels.text.stroke",
      "stylers": [{ "color": "#151619" }]
    },
    {
      "featureType": "administrative",
      "elementType": "geometry.stroke",
      "stylers": [{ "color": "#2D2F36" }]
    },
    {
      "featureType": "landscape",
      "elementType": "geometry",
      "stylers": [{ "color": "#1A1B1F" }]
    },
    {
      "featureType": "poi",
      "stylers": [{ "visibility": "off" }]
    },
    {
      "featureType": "road",
      "elementType": "geometry",
      "stylers": [{ "color": "#2D2F36" }]
    },
    {
      "featureType": "road",
      "elementType": "geometry.stroke",
      "stylers": [{ "color": "#151619" }]
    },
    {
      "featureType": "water",
      "elementType": "geometry",
      "stylers": [{ "color": "#0D0E11" }]
    }
  ]
};

interface NavigationMapProps {
  userLocation?: { lat: number; lng: number };
  onRegionSelect?: (region: RegionData) => void;
}

export const NavigationMap: React.FC<NavigationMapProps> = ({ 
  userLocation: initialUserLocation,
  onRegionSelect 
}) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(initialUserLocation || null);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [regions, setRegions] = useState<RegionData[]>([]);
  const [selectedShelter, setSelectedShelter] = useState<Shelter | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [tracking, setTracking] = useState(true);

  // Real-time location tracking
  useEffect(() => {
    if (!tracking) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserPos({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => console.error('Geolocation error:', error),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [tracking]);

  // Fetch Shelters & Regions
  useEffect(() => {
    const qShelters = query(collection(db, 'shelters'));
    const unsubShelters = onSnapshot(qShelters, (snapshot) => {
      setShelters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shelter)));
    });

    const qRegions = query(collection(db, 'regions'));
    const unsubRegions = onSnapshot(qRegions, (snapshot) => {
      setRegions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RegionData)));
    });

    return () => {
      unsubShelters();
      unsubRegions();
    };
  }, []);

  const calculateRoute = useCallback((shelter: Shelter) => {
    if (!userPos || !isLoaded) return;

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: userPos,
        destination: { lat: shelter.lat, lng: shelter.lng },
        travelMode: google.maps.TravelMode.WALKING
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          setDirections(result);
          setSelectedShelter(shelter);
        } else {
          console.error(`Directions request failed: ${status}`);
        }
      }
    );
  }, [userPos, isLoaded]);

  const getRiskColor = (level?: RiskLevel) => {
    switch (level) {
      case 'High': return '#FF4444';
      case 'Medium': return '#F27D26';
      case 'Low': return '#00FF00';
      default: return '#8E9299';
    }
  };

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  if (loadError || !apiKey) {
    return (
      <div className="w-full h-full flex flex-col bg-bg/50 backdrop-blur-xl rounded-3xl border border-line/50 overflow-hidden">
        <div className="p-6 border-b border-line/50 bg-warning/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-white">Map Engine Offline</h3>
              <p className="text-[9px] font-bold text-muted uppercase">Displaying District Risk Matrix Fallback</p>
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-card border border-line/50 text-white text-[8px] font-black uppercase tracking-widest rounded-xl hover:bg-accent hover:text-bg transition-all"
          >
            Retry Connection
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {regions.sort((a, b) => {
              const riskOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
              return (riskOrder[a.risk_level || 'Low'] || 3) - (riskOrder[b.risk_level || 'Low'] || 3);
            }).map(region => (
              <button
                key={region.id}
                onClick={() => onRegionSelect?.(region)}
                className={cn(
                  "p-4 rounded-2xl border transition-all text-left group",
                  region.risk_level === 'High' ? "bg-danger/5 border-danger/20 hover:border-danger/40" :
                  region.risk_level === 'Medium' ? "bg-warning/5 border-warning/20 hover:border-warning/40" :
                  "bg-card border-line/50 hover:border-accent/40"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-sm font-black uppercase tracking-tight text-white group-hover:text-accent transition-colors">{region.name}</h4>
                  <span className={cn(
                    "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border",
                    region.risk_level === 'High' ? "bg-danger/20 border-danger/30 text-danger" :
                    region.risk_level === 'Medium' ? "bg-warning/20 border-warning/30 text-warning" :
                    "bg-success/20 border-success/30 text-success"
                  )}>
                    {region.risk_level || 'Low'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-muted font-mono">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span>{region.lat.toFixed(2)}, {region.lng.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Home className="w-3 h-3" />
                    <span>{shelters.filter(s => s.regionId === region.id).length} Shelters</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isLoaded) return (
    <div className="w-full h-full flex items-center justify-center bg-bg/50 backdrop-blur-xl rounded-3xl border border-line/50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted">Initializing GIS Engine...</p>
      </div>
    </div>
  );

  return (
    <div className="w-full h-full relative">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={userPos || defaultCenter}
        zoom={userPos ? 14 : 7}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={mapOptions}
      >
        {/* User Location */}
        {userPos && (
          <Marker
            position={userPos}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#007AFF",
              fillOpacity: 1,
              strokeWeight: 4,
              strokeColor: "#FFFFFF",
            }}
            title="Your Location"
          />
        )}

        {/* Hazard Zones (Circles around regions with risk) */}
        {regions.map(region => (
          <React.Fragment key={region.id}>
            <Circle
              center={{ lat: region.lat, lng: region.lng }}
              radius={5000} // 5km radius for visualization
              options={{
                fillColor: getRiskColor(region.risk_level),
                fillOpacity: 0.15,
                strokeColor: getRiskColor(region.risk_level),
                strokeOpacity: 0.5,
                strokeWeight: 2,
              }}
            />
            <Marker
              position={{ lat: region.lat, lng: region.lng }}
              onClick={() => onRegionSelect?.(region)}
              icon={{
                path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                scale: 4,
                fillColor: getRiskColor(region.risk_level),
                fillOpacity: 1,
                strokeWeight: 1,
              }}
              title={`${region.name} - ${region.risk_level} Risk`}
            />
          </React.Fragment>
        ))}

        {/* Shelters */}
        {shelters.map(shelter => (
          <Marker
            key={shelter.id}
            position={{ lat: shelter.lat, lng: shelter.lng }}
            onClick={() => calculateRoute(shelter)}
            icon={{
              url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
              scaledSize: new google.maps.Size(32, 32)
            }}
          />
        ))}

        {/* Directions */}
        {directions && <DirectionsRenderer directions={directions} options={{ suppressMarkers: true }} />}

        {/* Info Window for Selected Shelter */}
        {selectedShelter && (
          <InfoWindow
            position={{ lat: selectedShelter.lat, lng: selectedShelter.lng }}
            onCloseClick={() => {
              setSelectedShelter(null);
              setDirections(null);
            }}
          >
            <div className="p-2 min-w-[200px] text-bg">
              <h3 className="font-bold text-sm mb-1">{selectedShelter.name}</h3>
              <p className="text-[10px] text-muted-foreground mb-2">{selectedShelter.address || 'Emergency Shelter'}</p>
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-bold">Capacity: {selectedShelter.capacity}</span>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-white",
                  selectedShelter.current_occupancy >= selectedShelter.capacity ? "bg-red-500" : "bg-green-500"
                )}>
                  {Math.round((selectedShelter.current_occupancy / selectedShelter.capacity) * 100)}% Full
                </span>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Map Controls Overlay */}
      <div className="absolute top-6 left-6 flex flex-col gap-3 pointer-events-none">
        <div className="glass p-4 rounded-2xl border border-line/50 pointer-events-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
              <Navigation className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-white">Navigation Active</h3>
              <p className="text-[9px] font-bold text-muted uppercase">Real-time GPS Tracking</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <button 
              onClick={() => setTracking(!tracking)}
              className={cn(
                "w-full py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border",
                tracking ? "bg-accent/10 border-accent/30 text-accent" : "bg-bg/50 border-line/50 text-muted"
              )}
            >
              {tracking ? 'GPS Tracking ON' : 'GPS Tracking OFF'}
            </button>
            
            {userPos && (
              <div className="p-2 bg-bg/30 rounded-xl border border-line/20">
                <div className="flex justify-between text-[8px] font-mono text-muted uppercase mb-1">
                  <span>LAT</span>
                  <span>{userPos.lat.toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-[8px] font-mono text-muted uppercase">
                  <span>LNG</span>
                  <span>{userPos.lng.toFixed(4)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedShelter && directions && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass p-4 rounded-2xl border border-accent/30 bg-accent/5 pointer-events-auto"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-bg" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-accent">Safe Route Found</h3>
                <p className="text-[9px] font-bold text-white/70 uppercase">To: {selectedShelter.name}</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <p className="text-[8px] text-muted uppercase mb-1">Distance</p>
                <p className="text-sm font-black text-white">{directions.routes[0].legs[0].distance?.text}</p>
              </div>
              <div className="flex-1">
                <p className="text-[8px] text-muted uppercase mb-1">Est. Time</p>
                <p className="text-sm font-black text-white">{directions.routes[0].legs[0].duration?.text}</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Legend Overlay */}
      <div className="absolute bottom-6 right-6 glass p-4 rounded-2xl border border-line/50 pointer-events-auto">
        <h4 className="text-[9px] font-black uppercase tracking-widest text-muted mb-3">Map Legend</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-danger" />
            <span className="text-[9px] font-bold uppercase text-white/70">Hazard Zone (High Risk)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-[9px] font-bold uppercase text-white/70">Emergency Shelter</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-[9px] font-bold uppercase text-white/70">Your Location</span>
          </div>
        </div>
      </div>
    </div>
  );
};
