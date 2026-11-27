import React, {useEffect, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {
  deleteUser,
  updateProfile,
} from 'firebase/auth';
import {deleteDoc, doc} from 'firebase/firestore';
import {getToken} from 'firebase/messaging';
import {BellRing, Camera, CheckCircle2, LogOut, Package, ShieldCheck, Trash2} from 'lucide-react';
import {z} from 'zod';
import {db, getFirebaseMessagingSafe} from '../lib/firebase';
import {useStore} from '../context/StoreContext';
import {BD_DIVISIONS, normalizeBdPhone} from '../lib/bd-locations';
import {profileSchema} from '../lib/validators';
import {updateCustomerProfile, uploadProductImage} from '../services/firestoreService';

type ProfileForm = z.infer<typeof profileSchema>;

export const ProfilePage: React.FC = () => {
  const {user, profile, authReady, isAdmin, wishlist, logout, showToast} = useStore();
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: {errors},
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: profile?.name || user?.displayName || '',
      phone: profile?.phone || '',
      division: profile?.division || 'Dhaka',
      district: profile?.district || 'Dhaka',
      upazila: profile?.upazila || '',
      area: profile?.area || '',
      fullAddress: profile?.fullAddress || '',
    },
  });

  useEffect(() => {
    if (profile) {
      reset({
        name: profile.name || user?.displayName || '',
        phone: profile.phone || '',
        division: profile.division || 'Dhaka',
        district: profile.district || 'Dhaka',
        upazila: profile.upazila || '',
        area: profile.area || '',
        fullAddress: profile.fullAddress || '',
      });
    }
  }, [profile, reset, user?.displayName]);

  if (!authReady) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-sm">Loading profile...</div>;
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center flex flex-col items-center gap-4">
        <h1 className="font-headline text-2xl font-bold">My Account</h1>
        <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
          Sign in to manage your profile, saved Bangladesh addresses, and orders.
        </p>
        <Link
          to="/login"
          className="px-6 py-2.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-sm font-semibold"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const onSaveProfile = async (data: ProfileForm) => {
    setSaving(true);
    try {
      await updateProfile(user, {displayName: data.name});
      await updateCustomerProfile(user.uid, {
        name: data.name,
        phone: data.phone ? normalizeBdPhone(data.phone) : '',
        division: data.division || 'Dhaka',
        district: data.district || 'Dhaka',
        upazila: data.upazila || '',
        area: data.area || '',
        fullAddress: data.fullAddress || '',
      });
      showToast('Profile saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadProductImage(file, `avatars/${user.uid}`);
      await updateProfile(user, {photoURL: url});
      await updateCustomerProfile(user.uid, {photoURL: url});
      showToast('Profile photo updated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed — check Firebase Storage rules');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleEnablePush = async () => {
    try {
      if (!('Notification' in window)) {
        showToast('Browser notifications not supported on this device');
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        showToast('Notification permission declined');
        return;
      }
      const messaging = await getFirebaseMessagingSafe();
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      let token = '';
      if (messaging && vapidKey) {
        token = await getToken(messaging, {vapidKey}).catch(() => '');
      }
      await updateCustomerProfile(user.uid, {
        pushEnabled: true,
        ...(token ? {fcmToken: token} : {}),
      });
      showToast('Order push notifications enabled');
    } catch {
      showToast('Push permission saved for in-app alerts');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteDoc(doc(db, 'users', user.uid));
      await deleteUser(user);
      showToast('Account deleted');
      navigate('/');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Please sign in again before deleting your account');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-6">
      {/* Header Card */}
      <section className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            {user.photoURL ? (
              <img src={user.photoURL} alt={profile?.name || 'Avatar'} referrerPolicy="no-referrer" className="w-16 h-16 rounded-full object-cover border border-light-outline-variant" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary flex items-center justify-center font-headline text-xl font-bold">
                {(profile?.name || user.email || 'U').slice(0, 2).toUpperCase()}
              </div>
            )}
            <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-light-surface-bright dark:bg-dark-surface-container border border-light-outline-variant flex items-center justify-center cursor-pointer" title="Upload photo">
              <Camera className="w-3.5 h-3.5" />
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} disabled={uploadingPhoto} className="hidden" />
            </label>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-headline text-xl font-bold">{profile?.name || user.displayName || 'Customer'}</h1>
              {user.emailVerified && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                </span>
              )}
            </div>
            <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">{user.email}</p>
            <p className="text-xs font-mono text-light-on-surface-variant dark:text-dark-on-surface-variant">{profile?.phone || 'Add Bangladesh phone number'}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/orders" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-light-surface-container dark:bg-dark-surface-container text-sm font-semibold">
            <Package className="w-4 h-4" /> My Orders
          </Link>
          <Link to="/wishlist" className="px-4 py-2 rounded-full bg-light-surface-container dark:bg-dark-surface-container text-sm font-semibold">
            Wishlist ({wishlist.length})
          </Link>
          {isAdmin && (
            <Link to="/admin" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-sm font-semibold">
              <ShieldCheck className="w-4 h-4" /> Admin Console
            </Link>
          )}
        </div>
      </section>

      {/* Edit Profile & Address */}
      <form onSubmit={handleSubmit(onSaveProfile)} className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-6 flex flex-col gap-4">
        <h2 className="font-headline text-lg font-bold">Profile & Default Bangladesh Address</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold">Full Name</span>
            <input {...register('name')} className="rounded-lg px-3.5 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant" />
            {errors.name && <span className="text-xs text-light-error">{errors.name.message}</span>}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold">Phone (+880)</span>
            <input {...register('phone')} placeholder="+880 17XX-XXXXXX" className="rounded-lg px-3.5 py-2 text-sm font-mono bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant" />
            {errors.phone && <span className="text-xs text-light-error">{errors.phone.message}</span>}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold">Division</span>
            <select {...register('division')} className="rounded-lg px-3.5 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant">
              {BD_DIVISIONS.map((d) => (
                <option key={d.name} value={d.name}>{d.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold">District</span>
            <input {...register('district')} className="rounded-lg px-3.5 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold">Upazila / Thana</span>
            <input {...register('upazila')} className="rounded-lg px-3.5 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold">Area</span>
            <input {...register('area')} className="rounded-lg px-3.5 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant" />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs font-semibold">Full Address</span>
            <input {...register('fullAddress')} className="rounded-lg px-3.5 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant" />
          </label>
        </div>
        <button type="submit" disabled={saving} className="self-start px-6 py-2.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-sm font-semibold">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      {/* Notifications & Security */}
      <section className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-6 flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BellRing className="w-5 h-5 text-light-primary dark:text-dark-primary" />
            <div>
              <h3 className="text-sm font-semibold">Order Push Notifications</h3>
              <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Receive dispatch and delivery alerts via Firebase Cloud Messaging.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleEnablePush}
            className="px-4 py-2 rounded-full border border-light-outline-variant dark:border-dark-outline-variant text-xs font-semibold"
          >
            {profile?.pushEnabled ? 'Push Enabled' : 'Enable Push Alerts'}
          </button>
        </div>

        <div className="pt-4 border-t border-light-outline-variant dark:border-dark-outline-variant flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => logout().then(() => navigate('/'))}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-light-outline-variant dark:border-dark-outline-variant text-sm font-semibold"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>

          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-light-error dark:text-dark-error"
            >
              <Trash2 className="w-4 h-4" /> Delete Account
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-light-error font-semibold">Confirm permanent deletion?</span>
              <button type="button" onClick={handleDeleteAccount} className="px-3 py-1.5 rounded-full bg-light-error text-light-on-error text-xs font-semibold">
                Yes, Delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-full border text-xs">
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
