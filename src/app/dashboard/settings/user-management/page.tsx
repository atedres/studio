
"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { collection, getDocs, doc, updateDoc, setDoc, serverTimestamp, query, where } from "firebase/firestore"
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth } from "firebase/auth";

import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { logActivity } from '@/lib/activityLogger';

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2, UserPlus, Edit, ArrowLeft } from "lucide-react"

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

export default function UserManagementPage() {
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
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      position: user.position || '',
      entity: user.entity || ''
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
    <div className="space-y-6">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href="/dashboard/settings"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">Gestion des Utilisateurs</h1>
                <p className="text-muted-foreground">
                    Attribuez des rôles et modifiez les profils des utilisateurs.
                </p>
            </div>
        </div>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Liste des utilisateurs</CardTitle>
                <CardDescription>Consultez et gérez tous les comptes de la plateforme.</CardDescription>
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
    </div>
  )
}
