import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { getChatHistory, addChatMessage, reset } from '../store/ride/rideSlice';
import io from 'socket.io-client';
import LiveMap from '../components/LiveMap';
import ChatBox from '../components/ChatBox';
import Spinner from '../components/Spinner';

const SOCKET_SERVER_URL = "https://co-ride-app.onrender.com";

const ActiveRidePage = () => {
    const { rideId } = useParams();
    const dispatch = useDispatch();
    const { user } = useSelector(state => state.auth);
    const { chatHistory, isLoading } = useSelector(state => state.rides);
    const socketRef = useRef(null);

    const [driverLocation, setDriverLocation] = useState(null);

    useEffect(() => {
        dispatch(getChatHistory(rideId));
        socketRef.current = io(SOCKET_SERVER_URL);
        socketRef.current.emit('joinRide', rideId);
        socketRef.current.on('locationUpdate', (location) => { setDriverLocation(location); });
        socketRef.current.on('receiveMessage', (message) => { dispatch(addChatMessage(message)); });
        
        // MODIFIED: Check for vehicle details to determine if user is the driver of ANY ride
        let watchId;
        if (user?.data?.vehicleDetails?.name) { // A simple proxy for being a potential driver
            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    const location = { lat: latitude, lng: longitude };
                    socketRef.current.emit('driverLocationUpdate', { rideId, location });
                },
                (error) => console.error("Geolocation Error:", error),
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        }

        return () => {
            if (watchId) navigator.geolocation.clearWatch(watchId);
            socketRef.current.disconnect();
            dispatch(reset());
        };
    }, [rideId, user?.data?.vehicleDetails?.name, dispatch]);

    const handleSendMessage = (text) => {
        socketRef.current.emit('sendMessage', {
            rideId,
            user: { name: user.data.name },
            text,
        });
    };

    if (isLoading && chatHistory.length === 0) {
        return <div className="flex justify-center items-center h-full"><Spinner /></div>;
    }

    return (
        <div className="container mx-auto py-8 grid grid-cols-1 lg:grid-cols-3 gap-8 h-[80vh]">
            <div className="lg:col-span-2 h-full">
                <LiveMap driverLocation={driverLocation} />
            </div>
            <div className="lg:col-span-1 h-full flex flex-col">
                <ChatBox messages={chatHistory} onSendMessage={handleSendMessage} />
            </div>
        </div>
    );
};

export default ActiveRidePage;