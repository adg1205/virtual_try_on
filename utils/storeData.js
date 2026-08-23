/**
 * Fictional Optical Store Branches across Dhaka City
 */

const STORES = [
    {
        id: 1,
        name: "VirtualTryOn Optics — Dhanmondi",
        address: "House 12, Road 27 (Old), Dhanmondi, Dhaka 1209",
        area: "Dhanmondi",
        lat: 23.7461,
        lng: 90.3742,
        phone: "+880 1712-345678",
        hours: "10:00 AM – 9:00 PM",
        openDays: "Everyday"
    },
    {
        id: 2,
        name: "VirtualTryOn Optics — Gulshan 2",
        address: "Plot 15, Avenue 2, Block C, Gulshan 2, Dhaka 1212",
        area: "Gulshan",
        lat: 23.7925,
        lng: 90.4167,
        phone: "+880 1712-345679",
        hours: "10:00 AM – 9:30 PM",
        openDays: "Everyday"
    },
    {
        id: 3,
        name: "VirtualTryOn Optics — Banani",
        address: "Road 11, Block D, Banani, Dhaka 1213",
        area: "Banani",
        lat: 23.7937,
        lng: 90.4047,
        phone: "+880 1712-345680",
        hours: "10:30 AM – 9:00 PM",
        openDays: "Sat–Thu"
    },
    {
        id: 4,
        name: "VirtualTryOn Optics — Mirpur 10",
        address: "Metro Rail Station Complex, Mirpur 10 Circle, Dhaka 1216",
        area: "Mirpur",
        lat: 23.8069,
        lng: 90.3687,
        phone: "+880 1712-345681",
        hours: "10:00 AM – 8:30 PM",
        openDays: "Everyday"
    },
    {
        id: 5,
        name: "VirtualTryOn Optics — Uttara Sector 7",
        address: "Sonargaon Janapath Road, Sector 7, Uttara, Dhaka 1230",
        area: "Uttara",
        lat: 23.8722,
        lng: 90.3984,
        phone: "+880 1712-345682",
        hours: "10:00 AM – 9:00 PM",
        openDays: "Everyday"
    },
    {
        id: 6,
        name: "VirtualTryOn Optics — Mohammadpur",
        address: "Tajmahal Road, Ring Road Crossing, Mohammadpur, Dhaka 1207",
        area: "Mohammadpur",
        lat: 23.7658,
        lng: 90.3622,
        phone: "+880 1712-345683",
        hours: "10:00 AM – 8:30 PM",
        openDays: "Sat–Thu"
    },
    {
        id: 7,
        name: "VirtualTryOn Optics — Motijheel C/A",
        address: "Dilkusha Commercial Area, Motijheel, Dhaka 1000",
        area: "Motijheel",
        lat: 23.7275,
        lng: 90.4194,
        phone: "+880 1712-345684",
        hours: "09:30 AM – 7:30 PM",
        openDays: "Sun–Thu"
    },
    {
        id: 8,
        name: "VirtualTryOn Optics — Bashundhara R/A",
        address: "Block C Main Avenue, Bashundhara R/A, Dhaka 1229",
        area: "Bashundhara",
        lat: 23.8151,
        lng: 90.4261,
        phone: "+880 1712-345685",
        hours: "10:00 AM – 9:30 PM",
        openDays: "Everyday"
    }
];

const DHAKA_AREAS = [
    { name: "Dhanmondi", lat: 23.7461, lng: 90.3742 },
    { name: "Gulshan", lat: 23.7925, lng: 90.4167 },
    { name: "Banani", lat: 23.7937, lng: 90.4047 },
    { name: "Mirpur", lat: 23.8069, lng: 90.3687 },
    { name: "Uttara", lat: 23.8722, lng: 90.3984 },
    { name: "Mohammadpur", lat: 23.7658, lng: 90.3622 },
    { name: "Motijheel", lat: 23.7275, lng: 90.4194 },
    { name: "Bashundhara", lat: 23.8151, lng: 90.4261 }
];

module.exports = { STORES, DHAKA_AREAS };
