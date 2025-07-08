
"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useForm } from "react-hook-form"
import { db, auth } from "@/lib/firebase"
import { collection, getDocs, doc, updateDoc, setDoc, serverTimestamp, query, where } from "firebase/firestore"
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { logActivity } from '@/lib/activityLogger';


import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { User, Bell, Lock, Users, Loader2, UserPlus, Edit, Database } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

const passwordSchema = z.object({
    currentPassword: z.string().min(1, "Le mot de passe actuel est requis."),
    newPassword: z.string().min(6, "Le nouveau mot de passe doit contenir au moins 6 caractères."),
    confirmPassword: z.string(),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les nouveaux mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

const userCreationSchema = z.object({
    email: z.string().email({ message: "L'adresse email est invalide." }),
    password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères."),
    firstName: z.string().min(1, "Le prénom est requis."),
    lastName: z.string().min(1, "Le nom est requis."),
    position: z.string().min(1, "Le poste est requis."),
    entity: z.string().min(1, "L'entité est requise."),
    role: z.enum(['niveau1', 'niveau2', 'niveau3', 'niveau4', 'niveau5', 'admin']),
});

type UserCreationFormValues = z.infer<typeof userCreationSchema>;

const userEditSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis."),
  lastName: z.string().min(1, "Le nom est requis."),
  position: z.string().min(1, "Le poste est requis."),
  entity: z.string().min(1, "L'entité est requise."),
});
type UserEditFormValues = z.infer<typeof userEditSchema>;


const profileSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis."),
  lastName: z.string().min(1, "Le nom de famille est requis."),
});
type ProfileFormValues = z.infer<typeof profileSchema>;


interface AppUserDoc {
  id: string;
  email: string;
  displayName: string;
  role: string;
  firstName: string;
  lastName: string;
  position: string;
  entity: string;
}

const UserManagementCard = () => {
  const [users, setUsers] = useState<AppUserDoc[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUserDoc | null>(null);
  const { toast } = useToast();
  const { user: adminUser, updateUserDocument } = useAuth();

  const [postes, setPostes] = useState<string[]>([]);
  const [entites, setEntites] = useState<string[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  const userCreationForm = useForm<UserCreationFormValues>({
    resolver: zodResolver(userCreationSchema),
    defaultValues: {
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        position: "",
        entity: "",
        role: "niveau1",
    }
  });

  const userEditForm = useForm<UserEditFormValues>({
    resolver: zodResolver(userEditSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      position: '',
      entity: ''
    }
  });

  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const usersCollection = collection(db, "users");
        const usersSnapshot = await getDocs(usersCollection);
        const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AppUserDoc[];
        setUsers(usersList);
      } catch (error) {
        console.error("Error fetching users: ", error);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de charger la liste des utilisateurs.",
        });
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [toast]);

  useEffect(() => {
    const fetchLists = async () => {
        setLoadingLists(true);
        try {
            const fetchData = async (collectionName: string) => {
                const q = query(collection(db, collectionName), where("actif", "==", true));
                const snapshot = await getDocs(q);
                return snapshot.docs.map(doc => doc.data().nom as string);
            };

            const [postesData, entitesData] = await Promise.all([
                fetchData("postesDeTravail"),
                fetchData("zonesDeTravail") // 'Entité' corresponds to 'zonesDeTravail'
            ]);
            
            setPostes(postesData);
            setEntites(entitesData);

        } catch (error) {
            console.error("Error fetching lists for settings: ", error);
            toast({
                variant: "destructive",
                title: "Erreur de chargement",
                description: "Impossible de charger les listes pour les postes et entités.",
            });
        } finally {
            setLoadingLists(false);
        }
    };

    fetchLists();
  }, [toast]);


  const handleRoleChange = async (userId: string, newRole: string) => {
    const userToUpdate = users.find(u => u.id === userId);
    if (!userToUpdate) return;
    
    const userDocRef = doc(db, "users", userId);
    try {
      await updateDoc(userDocRef, { role: newRole });
      setUsers(prevUsers => prevUsers.map(u => u.id === userId ? { ...u, role: newRole } : u));
      await logActivity(adminUser, "Modification du rôle de l'utilisateur", { targetUserEmail: userToUpdate.email, newRole });
      toast({
        title: "Rôle mis à jour",
        description: `Le rôle a été changé en ${newRole}.`,
      });
    } catch (error) {
      console.error("Error updating role: ", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre à jour le rôle.",
      });
    }
  };
  
  const handleEditClick = (user: AppUserDoc) => {
    setEditingUser(user);
    userEditForm.reset({
      firstName: user.firstName,
      lastName: user.lastName,
      position: user.position,
      entity: user.entity,
    });
    setIsEditUserOpen(true);
  };

  const handleUpdateUser = async (values: UserEditFormValues) => {
    if (!editingUser || !updateUserDocument) return;

    try {
      await updateUserDocument(editingUser.id, values);
      setUsers(prevUsers => 
        prevUsers.map(u => 
          u.id === editingUser.id ? { ...u, ...values, displayName: `${values.firstName} ${values.lastName}` } : u
        )
      );
      await logActivity(adminUser, "Modification des informations de l'utilisateur", { targetUserEmail: editingUser.email });
      toast({
        title: "Utilisateur mis à jour",
        description: `Les informations pour ${editingUser.email} ont été mises à jour.`,
      });
      setIsEditUserOpen(false);
      setEditingUser(null);
    } catch (error) {
      console.error("Error updating user: ", error);
      toast({
        variant: "destructive",
        title: "Erreur de mise à jour",
        description: "Impossible de mettre à jour l'utilisateur.",
      });
    }
  };

  const handleCreateUser = async (values: UserCreationFormValues) => {
    // This is a workaround to create a user without signing out the admin.
    // We create a temporary, secondary Firebase app instance to handle the creation.
    const tempAppName = `user-creation-${Date.now()}`;
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    };

    const tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);

    try {
        const userCredential = await createUserWithEmailAndPassword(tempAuth, values.email, values.password);
        const newUser = userCredential.user;
        const displayName = `${values.firstName} ${values.lastName}`;
        
        await updateProfile(newUser, { displayName });

        await setDoc(doc(db, "users", newUser.uid), {
            email: newUser.email,
            displayName: displayName,
            firstName: values.firstName,
            lastName: values.lastName,
            position: values.position,
            entity: values.entity,
            role: values.role,
            createdAt: serverTimestamp(),
        });

        await logActivity(adminUser, "Création d'un utilisateur", { newUserEmail: values.email, role: values.role });
        
        setUsers(prev => [...prev, { 
            id: newUser.uid, 
            email: newUser.email!, 
            displayName: displayName, 
            role: values.role,
            firstName: values.firstName,
            lastName: values.lastName,
            position: values.position,
            entity: values.entity
        }]);

        toast({
            title: "Utilisateur créé avec succès",
            description: `Le compte pour ${values.email} a été créé.`,
        });

        userCreationForm.reset();
        setIsCreateUserOpen(false);
        
    } catch (error: any) {
        console.error("Error creating user: ", error);
        let description = "Une erreur est survenue lors de la création de l'utilisateur.";
        if (error.code === 'auth/email-already-in-use') {
            description = "Cette adresse email est déjà utilisée par un autre compte.";
            userCreationForm.setError("email", { type: "manual", message: description });
        } else if (error.code === 'auth/weak-password') {
            description = "Le mot de passe est trop faible.";
             userCreationForm.setError("password", { type: "manual", message: description });
        }
        toast({
            variant: "destructive",
            title: "Erreur de création",
            description,
        });
    } finally {
        await deleteApp(tempApp);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Gestion des Utilisateurs</CardTitle>
            <CardDescription>Attribuez des rôles et modifiez les profils des utilisateurs.</CardDescription>
        </div>
        <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
            <DialogTrigger asChild>
                <Button><UserPlus className="mr-2 h-4 w-4" /> Ajouter un utilisateur</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Créer un nouvel utilisateur</DialogTitle>
                    <DialogDescription>
                        Assignez un email, un mot de passe temporaire et un rôle.
                    </DialogDescription>
                </DialogHeader>
                 <Form {...userCreationForm}>
                    <form onSubmit={userCreationForm.handleSubmit(handleCreateUser)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={userCreationForm.control} name="lastName" render={({ field }) => (
                                <FormItem><FormLabel>Nom</FormLabel><FormControl><Input placeholder="Dupont" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                             <FormField control={userCreationForm.control} name="firstName" render={({ field }) => (
                                <FormItem><FormLabel>Prénom</FormLabel><FormControl><Input placeholder="Jean" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                        </div>
                        <FormField control={userCreationForm.control} name="email" render={({ field }) => (
                            <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="utilisateur@exemple.com" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={userCreationForm.control} name="password" render={({ field }) => (
                            <FormItem><FormLabel>Mot de passe temporaire</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <div className="grid grid-cols-2 gap-4">
                             <FormField control={userCreationForm.control} name="position" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Poste</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={loadingLists}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={loadingLists ? "Chargement..." : "Sélectionner un poste"} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {postes.map(poste => <SelectItem key={poste} value={poste}>{poste}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            <FormField control={userCreationForm.control} name="entity" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Entité</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={loadingLists}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={loadingLists ? "Chargement..." : "Sélectionner une entité"} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {entites.map(entite => <SelectItem key={entite} value={entite}>{entite}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                        </div>
                        <FormField control={userCreationForm.control} name="role" render={({ field }) => (
                            <FormItem><FormLabel>Rôle</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Choisir un rôle" /></SelectTrigger></FormControl><SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="niveau5">Direction</SelectItem>
                                <SelectItem value="niveau4">Responsable</SelectItem>
                                <SelectItem value="niveau3">Superviseur</SelectItem>
                                <SelectItem value="niveau2">Animateur</SelectItem>
                                <SelectItem value="niveau1">Collaborateur</SelectItem>
                            </SelectContent></Select><FormMessage /></FormItem>
                        )}/>
                        <DialogFooter>
                            <Button type="submit" disabled={userCreationForm.formState.isSubmitting}>
                                {userCreationForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Créer l'utilisateur
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom & Prénom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingUsers ? (
              [...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-10 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-10 w-10" /></TableCell>
                </TableRow>
              ))
            ) : (
              users.map(u => (
                <TableRow key={u.id}>
                  <TableCell>
                      <div className="font-medium">{u.displayName}</div>
                      <div className="text-sm text-muted-foreground">{u.position} ({u.entity})</div>
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Select value={u.role} onValueChange={(value) => handleRoleChange(u.id, value)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Choisir un rôle" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="niveau5">Direction</SelectItem>
                        <SelectItem value="niveau4">Responsable</SelectItem>
                        <SelectItem value="niveau3">Superviseur</SelectItem>
                        <SelectItem value="niveau2">Animateur</SelectItem>
                        <SelectItem value="niveau1">Collaborateur</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleEditClick(u)}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Modifier</span>
                      </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Modifier l'utilisateur</DialogTitle>
                    <DialogDescription>Mettez à jour les informations de {editingUser?.email}.</DialogDescription>
                </DialogHeader>
                <Form {...userEditForm}>
                    <form onSubmit={userEditForm.handleSubmit(handleUpdateUser)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={userEditForm.control} name="lastName" render={({ field }) => (
                                <FormItem><FormLabel>Nom</FormLabel><FormControl><Input placeholder="Dupont" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={userEditForm.control} name="firstName" render={({ field }) => (
                                <FormItem><FormLabel>Prénom</FormLabel><FormControl><Input placeholder="Jean" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={userEditForm.control} name="position" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Poste</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={loadingLists}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={loadingLists ? "Chargement..." : "Sélectionner un poste"} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {postes.map(poste => <SelectItem key={poste} value={poste}>{poste}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            <FormField control={userEditForm.control} name="entity" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Entité</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={loadingLists}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={loadingLists ? "Chargement..." : "Sélectionner une entité"} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {entites.map(entite => <SelectItem key={entite} value={entite}>{entite}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={userEditForm.formState.isSubmitting}>
                                {userEditForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Enregistrer les modifications
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

const AccessRightsPlaceholder = () => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Gestion des Droits d'Accès</CardTitle>
      <CardDescription>Visualisez les permissions pour chaque rôle utilisateur.</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        Contactez votre administrateur pour modifier les rôles des utilisateurs.
      </p>
    </CardContent>
  </Card>
);

export default function SettingsPage() {
  const { user, updateUserProfile, updateUserPassword } = useAuth()
  const { toast } = useToast()
  const isAdmin = user?.role === 'admin';

  const [email, setEmail] = useState("")
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    }
  });

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
    },
  });

  useEffect(() => {
    if (user) {
        profileForm.reset({
            firstName: user.firstName || "",
            lastName: user.lastName || "",
        });
        setEmail(user.email || "")
    }
  }, [user, profileForm])

  const handleProfileUpdate = async (values: ProfileFormValues) => {
    setIsUpdatingProfile(true)
    try {
        if (updateUserProfile) {
          const displayName = `${values.firstName} ${values.lastName}`;
          await updateUserProfile({ displayName, ...values })
          await logActivity(user, "Mise à jour de son profil");
          toast({
              title: "Profil Mis à Jour",
              description: "Votre nom a été mis à jour avec succès.",
          })
        }
    } catch (error) {
        console.error(error)
        toast({
            variant: "destructive",
            title: "Erreur",
            description: "Impossible de mettre à jour le profil.",
        })
    } finally {
        setIsUpdatingProfile(false)
    }
  }

  const handlePasswordUpdate = async (values: PasswordFormValues) => {
    if (!updateUserPassword) return;

    try {
        await updateUserPassword(values.currentPassword, values.newPassword);
        await logActivity(user, "Modification de son mot de passe");
        toast({
            title: "Succès",
            description: "Votre mot de passe a été changé avec succès.",
        });
        passwordForm.reset();
        setIsPasswordDialogOpen(false);
    } catch (error: any) {
        console.error("Password change error:", error);
        let description = "Une erreur est survenue.";
        if (error.code === 'auth/wrong-password') {
            description = "Le mot de passe actuel est incorrect.";
            passwordForm.setError("currentPassword", { type: "manual", message: "Mot de passe incorrect." });
        }
        toast({
            variant: "destructive",
            title: "Erreur de changement de mot de passe",
            description,
        });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Paramètres / الإعدادات</h1>
        <p className="text-muted-foreground">
          Gérez les paramètres du compte, les accès et les notifications.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
            {isAdmin ? <UserManagementCard /> : <AccessRightsPlaceholder />}
            
            {isAdmin && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Database className="h-5 w-5" /> Gestion des Données
                        </CardTitle>
                        <CardDescription>
                          Ajoutez ou modifiez les entrées pour les listes déroulantes utilisées dans l'application (zones, postes, etc.).
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                          Centralisez la gestion de vos données de référence pour assurer la cohérence des formulaires.
                        </p>
                    </CardContent>
                    <CardFooter>
                        <Button asChild>
                            <Link href="/dashboard/settings/data-management">
                                Accéder à la gestion des données
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notifications</CardTitle>
                    <CardDescription>Configurez les notifications par email.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="notif-deadline">Échéance d'action proche</Label>
                        <Switch id="notif-deadline" defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="notif-validation">Action non validée après 48h</Label>
                        <Switch id="notif-validation" defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="notif-report">Rapport hebdomadaire</Label>
                        <Switch id="notif-report" />
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Mon Profil</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(handleProfileUpdate)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                           <FormField control={profileForm.control} name="lastName" render={({ field }) => (
                                <FormItem><FormLabel>Nom</FormLabel><FormControl><Input {...field} disabled={!isAdmin} /></FormControl><FormMessage /></FormItem>
                            )}/>
                             <FormField control={profileForm.control} name="firstName" render={({ field }) => (
                                <FormItem><FormLabel>Prénom</FormLabel><FormControl><Input {...field} disabled={!isAdmin} /></FormControl><FormMessage /></FormItem>
                            )}/>
                        </div>
                       <div>
                          <Label htmlFor="email-settings">Email</Label>
                          <Input id="email-settings" type="email" value={email} readOnly disabled />
                      </div>
                      {!isAdmin && (
                        <p className="text-xs text-muted-foreground pt-1">Seul un administrateur peut modifier le nom.</p>
                      )}
                      <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={isUpdatingProfile || !isAdmin}>
                          {isUpdatingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Mettre à jour le profil
                      </Button>
                  </form>
                  </Form>
                </CardContent>
             </Card>

             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> Sécurité</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                        <DialogTrigger asChild>
                             <Button variant="outline" className="w-full">Changer le mot de passe</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Changer le mot de passe</DialogTitle>
                                <DialogDescription>
                                    Entrez votre mot de passe actuel et votre nouveau mot de passe.
                                </DialogDescription>
                            </DialogHeader>
                            <Form {...passwordForm}>
                                <form onSubmit={passwordForm.handleSubmit(handlePasswordUpdate)} className="space-y-4">
                                     <FormField
                                        control={passwordForm.control}
                                        name="currentPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Mot de passe actuel</FormLabel>
                                                <FormControl>
                                                    <Input type="password" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={passwordForm.control}
                                        name="newPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Nouveau mot de passe</FormLabel>
                                                <FormControl>
                                                    <Input type="password" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={passwordForm.control}
                                        name="confirmPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Confirmer le nouveau mot de passe</FormLabel>
                                                <FormControl>
                                                    <Input type="password" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <DialogFooter>
                                        <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
                                            {passwordForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Enregistrer
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                    <Button variant="outline" className="w-full">Activer l'authentification à deux facteurs</Button>
                    <p className="text-xs text-muted-foreground text-center pt-2">Dernière modification de mot de passe: il y a 3 mois.</p>
                </CardContent>
             </Card>
        </div>
      </div>
    </div>
  )
}
