'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, MapPin, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';

type Stage = 'START' | 'CLOCK IN' | 'CLOCK OUT' | 'END';

const STAGES: Stage[] = [
  'START',
  'CLOCK IN',
  'CLOCK OUT',
  'END',
];

export default function PerjalananDinasPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);

  const [destination, setDestination] = useState('');
  const [purpose, setPurpose] = useState('');

  const [currentStage, setCurrentStage] =
    useState<Stage>('START');

  const [location, setLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);

  const [address, setAddress] =
    useState('Mencari lokasi...');

  const [photo, setPhoto] =
    useState<string | null>(null);

  const [cameraOpen, setCameraOpen] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [tripId, setTripId] =
    useState<string | null>(null);

  const videoRef =
    useRef<HTMLVideoElement | null>(null);

  const canvasRef =
    useRef<HTMLCanvasElement | null>(null);

  // =====================================
  // USER LOGIN
  // =====================================

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error('Anda belum login.');
        router.push('/login');
        return;
      }

      setUserId(user.id);
    };

    getUser();
  }, [router]);

  // =====================================
  // CLEANUP CAMERA
  // =====================================

  useEffect(() => {
    return () => {
      if (videoRef.current?.srcObject) {
        const stream =
          videoRef.current.srcObject as MediaStream;

        stream.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, []);

  // =====================================
  // GPS
  // =====================================

  const fetchLocation = () => {
    if (!navigator.geolocation) {
      toast.error(
        'Geolocation tidak didukung browser.'
      );
      return;
    }

    setAddress('Mengambil lokasi...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        setLocation({
          lat,
          lon,
        });

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
          );

          const data = await res.json();

          setAddress(
            data.display_name ||
              'Alamat tidak ditemukan'
          );
        } catch {
          setAddress(
            'Alamat tidak dapat ditemukan'
          );
        }
      },
      () => {
        toast.error(
          'Gagal mendapatkan lokasi.'
        );
        setAddress(
          'Lokasi tidak tersedia'
        );
      }
    );
  };

  useEffect(() => {
    fetchLocation();
  }, []);

  // =====================================
  // CAMERA
  // =====================================

const openCamera = async () => {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Browser tidak mendukung akses kamera.');
      return;
    }

    // Hentikan stream lama jika masih ada
    if (videoRef.current?.srcObject) {
      const oldStream =
        videoRef.current.srcObject as MediaStream;

      oldStream.getTracks().forEach((track) => {
        track.stop();
      });

      videoRef.current.srcObject = null;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    setCameraOpen(true);

    // Tunggu elemen video benar-benar muncul
    setTimeout(async () => {
      if (!videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        toast.error('Preview kamera tidak ditemukan.');
        return;
      }

      videoRef.current.srcObject = stream;

      try {
        await videoRef.current.play();
      } catch (err) {
        console.error('Video play error:', err);
      }
    }, 100);

  } catch (error: any) {
    console.error('Camera error:', error);

    if (error?.name === 'NotAllowedError') {
      toast.error('Akses kamera ditolak.');
    } else if (error?.name === 'NotFoundError') {
      toast.error('Kamera tidak ditemukan.');
    } else if (error?.name === 'NotReadableError') {
      toast.error('Kamera sedang digunakan aplikasi lain.');
    } else {
      toast.error('Kamera tidak dapat dibuka.');
    }
  }
};

  // =====================================
  // CAPTURE PHOTO
  // =====================================

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    const width = 540;
    const height = 720;

    canvas.width = width;
    canvas.height = height;

    const ctx =
      canvas.getContext('2d');

    if (!ctx) return;

    ctx.drawImage(
      video,
      0,
      0,
      width,
      height
    );

    // WATERMARK
    ctx.fillStyle =
      'rgba(0,0,0,0.55)';

    ctx.fillRect(
      0,
      height - 170,
      width,
      170
    );

    ctx.fillStyle = '#ffffff';

    ctx.font =
      'bold 28px Arial';

    ctx.fillText(
      'SMART PPNPN',
      20,
      height - 130
    );

    ctx.font =
      '20px Arial';

    ctx.fillText(
      new Date().toLocaleString(
        'id-ID'
      ),
      20,
      height - 95
    );

    if (location) {
      ctx.fillText(
        `${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}`,
        20,
        height - 60
      );
    }

    ctx.fillText(
      address.substring(0, 45),
      20,
      height - 25
    );

    const image =
      canvas.toDataURL(
        'image/jpeg',
        0.7
      );

    setPhoto(image);
    setCameraOpen(false);

    const stream =
      video.srcObject as MediaStream;

    stream
      ?.getTracks()
      .forEach((track) => {
        track.stop();
      });
  };

  // =====================================
  // START PERJALANAN
  // =====================================

  const handleStart = async () => {
    if (!userId) {
      return toast.error(
        'User belum ditemukan.'
      );
    }

    if (!destination.trim()) {
      return toast.error(
        'Masukkan tujuan perjalanan.'
      );
    }

    if (!purpose.trim()) {
      return toast.error(
        'Masukkan keperluan perjalanan.'
      );
    }

    if (!location) {
      return toast.error(
        'Lokasi belum tersedia.'
      );
    }

    if (!photo) {
      return toast.error(
        'Silakan ambil foto terlebih dahulu.'
      );
    }

    setIsSubmitting(true);

    try {
      // =========================
      // UPLOAD FOTO
      // =========================

      const response =
        await fetch(photo);

      const blob =
        await response.blob();

      const fileName =
        `business-trip/${userId}_start_${Date.now()}.jpg`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from('attendance-photos')
        .upload(
          fileName,
          blob,
          {
            contentType:
              'image/jpeg',
          }
        );

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: publicUrlData,
      } =
        supabase.storage
          .from('attendance-photos')
          .getPublicUrl(
            fileName
          );

      const photoUrl =
        publicUrlData.publicUrl;

      // =========================
      // INSERT PERJALANAN
      // =========================

      const {
        data,
        error,
      } = await supabase
        .from(
          'business_trip_attendances'
        )
        .insert({
          user_id: userId,

          trip_date:
            new Date()
              .toISOString()
              .split('T')[0],

          destination:
            destination,

          purpose:
            purpose,

          start_at:
            new Date().toISOString(),

          start_latitude:
            location.lat,

          start_longitude:
            location.lon,

          start_photo_url:
            photoUrl,

          status:
            'ongoing',
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      setTripId(data.id);

      setCurrentStage(
        'CLOCK IN'
      );

      setPhoto(null);

      toast.success(
        'START perjalanan berhasil.'
      );
    } catch (error: any) {
      console.error(error);

      toast.error(
        error?.message ||
          'Gagal memulai perjalanan.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // =====================================
  // STAGE BERIKUTNYA
  // =====================================

  const handleNextStage =
    async () => {
      if (!tripId) {
        return toast.error(
          'Data perjalanan tidak ditemukan.'
        );
      }

      if (!location) {
        return toast.error(
          'Lokasi belum tersedia.'
        );
      }

      if (!photo) {
        return toast.error(
          'Silakan ambil foto terlebih dahulu.'
        );
      }

      setIsSubmitting(true);

      try {
        const response =
          await fetch(photo);

        const blob =
          await response.blob();

        const fileName =
          `business-trip/${userId}_${currentStage
            .toLowerCase()
            .replace(' ', '_')}_${Date.now()}.jpg`;

        const {
          error: uploadError,
        } = await supabase.storage
          .from('attendance-photos')
          .upload(
            fileName,
            blob,
            {
              contentType:
                'image/jpeg',
            }
          );

        if (uploadError) {
          throw uploadError;
        }

        const {
          data: publicUrlData,
        } =
          supabase.storage
            .from(
              'attendance-photos'
            )
            .getPublicUrl(
              fileName
            );

        const photoUrl =
          publicUrlData.publicUrl;

        const now =
          new Date().toISOString();

        // =========================
        // CLOCK IN
        // =========================

        if (
          currentStage ===
          'CLOCK IN'
        ) {
          await supabase
            .from(
              'business_trip_attendances'
            )
            .update({
              clock_in_at: now,
              clock_in_latitude:
                location.lat,
              clock_in_longitude:
                location.lon,
              clock_in_photo_url:
                photoUrl,
            })
            .eq('id', tripId);

          setCurrentStage(
            'CLOCK OUT'
          );
        }

        // =========================
        // CLOCK OUT
        // =========================

        else if (
          currentStage ===
          'CLOCK OUT'
        ) {
          await supabase
            .from(
              'business_trip_attendances'
            )
            .update({
              clock_out_at: now,
              clock_out_latitude:
                location.lat,
              clock_out_longitude:
                location.lon,
              clock_out_photo_url:
                photoUrl,
            })
            .eq('id', tripId);

          setCurrentStage('END');
        }

        // =========================
        // END
        // =========================

        else if (
          currentStage ===
          'END'
        ) {
          await supabase
            .from(
              'business_trip_attendances'
            )
            .update({
              end_at: now,
              end_latitude:
                location.lat,
              end_longitude:
                location.lon,
              end_photo_url:
                photoUrl,
              status:
                'completed',
              updated_at: now,
            })
            .eq('id', tripId);

          toast.success(
            'Perjalanan dinas selesai.'
          );

          router.push(
            '/dashboard'
          );

          return;
        }

        setPhoto(null);

        toast.success(
          `${currentStage} berhasil.`
        );
      } catch (error: any) {
        console.error(error);

        toast.error(
          error?.message ||
            'Gagal menyimpan presensi.'
        );
      } finally {
        setIsSubmitting(false);
      }
    };

  // =====================================
  // LABEL BUTTON
  // =====================================

  const getButtonText = () => {
    if (currentStage === 'START') {
      return 'START PERJALANAN';
    }

    if (currentStage === 'CLOCK IN') {
      return 'CLOCK IN DI TUJUAN';
    }

    if (currentStage === 'CLOCK OUT') {
      return 'CLOCK OUT';
    }

    return 'END PERJALANAN';
  };

  // =====================================
  // SUBMIT
  // =====================================

  const handleSubmit = () => {
    if (currentStage === 'START') {
      handleStart();
    } else {
      handleNextStage();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <header className="bg-blue-900 text-white p-4 flex items-center">
        <button
          onClick={() =>
            router.back()
          }
          className="mr-4"
        >
          <ArrowLeft size={24} />
        </button>

        <h1 className="text-xl font-bold">
          Perjalanan Dinas
        </h1>
      </header>

      <main className="p-6 max-w-2xl mx-auto">

        {/* INFORMASI PERJALANAN */}
        {currentStage === 'START' && (
          <div className="bg-white p-5 rounded-xl shadow mb-5">
            <h2 className="font-bold text-lg mb-4">
              Informasi Perjalanan
            </h2>

            <label className="font-semibold">
              Tujuan
            </label>

            <input
              value={destination}
              onChange={(e) =>
                setDestination(
                  e.target.value
                )
              }
              placeholder="Contoh: Banda Aceh"
              className="w-full border rounded-lg p-3 mt-2 mb-4"
            />

            <label className="font-semibold">
              Keperluan
            </label>

            <textarea
              value={purpose}
              onChange={(e) =>
                setPurpose(
                  e.target.value
                )
              }
              placeholder="Keperluan perjalanan dinas"
              className="w-full border rounded-lg p-3 mt-2"
              rows={4}
            />
          </div>
        )}

        {/* PROGRESS */}
        <div className="bg-white p-5 rounded-xl shadow mb-5">
          <h2 className="font-bold mb-4">
            Status Perjalanan
          </h2>

          <div className="space-y-3">
            {STAGES.map(
              (stage, index) => {
                const currentIndex =
                  STAGES.indexOf(
                    currentStage
                  );

                const stageIndex =
                  index;

                return (
                  <div
                    key={stage}
                    className="flex items-center gap-3"
                  >
                    <div>
                      {stageIndex <
                      currentIndex ? (
                        <CheckCircle
                          className="text-green-600"
                        />
                      ) : (
                        <div
                          className={`w-6 h-6 rounded-full border-2 ${
                            stage ===
                            currentStage
                              ? 'border-blue-700'
                              : 'border-gray-300'
                          }`}
                        />
                      )}
                    </div>

                    <span
                      className={
                        stage ===
                        currentStage
                          ? 'font-bold text-blue-900'
                          : 'text-gray-600'
                      }
                    >
                      {stage}
                    </span>
                  </div>
                );
              }
            )}
          </div>
        </div>

        {/* LOKASI */}
        <div className="bg-white p-5 rounded-xl shadow mb-5">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={20} />

            <h2 className="font-bold">
              Lokasi
            </h2>
          </div>

          <p className="text-sm text-gray-600">
            {address}
          </p>

          {location && (
            <p className="text-sm text-gray-500 mt-2">
              {location.lat.toFixed(6)},
              {' '}
              {location.lon.toFixed(6)}
            </p>
          )}

          <button
            onClick={fetchLocation}
            className="mt-3 bg-blue-900 text-white px-4 py-2 rounded-lg"
          >
            Ambil Ulang Lokasi
          </button>
        </div>

        {/* CAMERA */}
        <div className="bg-white p-5 rounded-xl shadow mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Camera size={20} />

            <h2 className="font-bold">
              Foto Presensi
            </h2>
          </div>

          {!photo &&
            !cameraOpen && (
              <button
                onClick={openCamera}
                className="bg-green-600 text-white px-4 py-3 rounded-lg"
              >
                Buka Kamera
              </button>
            )}

          {cameraOpen && (
            <div>
                <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                controls={false}
                className="w-full rounded-lg bg-black"
                style={{
                    width: '100%',
                    minHeight: '300px',
                    objectFit: 'cover',
                    }}
                    />
              <button
                onClick={
                  capturePhoto
                }
                className="mt-3 bg-blue-900 text-white px-4 py-3 rounded-lg"
              >
                Ambil Foto
              </button>
            </div>
          )}

          {photo && (
            <div>
              <img
                src={photo}
                alt="Preview"
                className="w-full rounded-lg"
              />

              <button
                onClick={() => {
                  setPhoto(null);
                  openCamera();
                }}
                className="mt-3 bg-yellow-500 text-white px-4 py-2 rounded-lg"
              >
                Ambil Ulang
              </button>
            </div>
          )}

          <canvas
            ref={canvasRef}
            className="hidden"
          />
        </div>

        {/* SUBMIT */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={`w-full py-4 rounded-xl text-white font-bold ${
            isSubmitting
              ? 'bg-gray-400'
              : 'bg-blue-900 hover:bg-blue-800'
          }`}
        >
          {isSubmitting
            ? 'Memproses...'
            : getButtonText()}
        </button>

      </main>
    </div>
  );
}