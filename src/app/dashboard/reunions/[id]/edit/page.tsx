
"use client"

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from '@/hooks/use-auth'
import { format } from "date-fns"
import { Calendar as CalendarIcon, ArrowLeft, Loader2 } from "lucide-react"
import { db, storage } from "@/lib/firebase"
import { doc, getDoc, updateDoc, Timestamp, collection, getDocs } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { logActivity } from '@/lib/activityLogger'
import { Badge } from '@/components/ui/badge'

const reunionSchema = z.object({
  nature: z.enum(["presentielle", "distancielle"], { required_error: "La nature de la réunion est requise." }),
  source: z.string().min(1, "La source est requise."),
  objet: z.string().min(1, "L'objet est requis."),
  date: z.date({ required_error: "La date est requise." }),
  heure: z.string().min(1, "L'heure est requise."),
  lieu: z.string().min(1, "Le lieu est requis."),
  animateur: z.string().min(1, "L'animateur est requis."),
  duree: z.string().min(1, "La durée est requise."),
  collaborateurs: z.string().min(1, "Les collaborateurs sont requis."),
  support: z.any().optional(), // File upload
  status: z.enum(["Planifiée", "Réalisée", "Annulée"], { required_error: "Le statut est requis." }),
  compteRendu: z.string().optional().default(''),
})

type ReunionFormValues = z.infer<typeof reunionSchema>

const timeSlots = Array.from({ length: (18 - 8) * 2 + 1 }, (_, i) => {
    const hours = 8 + Math.floor(i / 2);
    const minutes = (i % 2) * 30;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
});


export default function EditReunionPage() {
  const { toast } = useToast()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { user } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [existingSupportUrl, setExistingSupportUrl] = useState<string | null>(null)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)

  const [users, setUsers] = useState<{ id: string, displayName: string }[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  const form = useForm<ReunionFormValues>({
    resolver: zodResolver(reunionSchema),
    defaultValues: {},
  })

  useEffect(() => {
    const fetchUsers = async () => {
        setLoadingLists(true);
        try {
            const usersCollection = collection(db, "users");
            const usersSnapshot = await getDocs(usersCollection);
            const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as { id: string, displayName: string }[];
            setUsers(usersList);
        } catch (error) {
            console.error("Error fetching users: ", error);
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger la liste des utilisateurs." });
        } finally {
            setLoadingLists(false);
        }
    };
    fetchUsers();
  }, [toast]);

  useEffect(() => {
    if (!id) return;

    const fetchAndSetReunion = async () => {
      setLoading(true);
      const docRef = doc(db, "reunions", id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const transformedData = {
          ...data,
          date: (data.date as Timestamp).toDate(),
          support: undefined, // Don't pre-fill file input
        };
        form.reset(transformedData as ReunionFormValues);
        if (data.supportUrl) {
            setExistingSupportUrl(data.supportUrl);
        }
      } else {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "La réunion demandée n'existe pas.",
        });
        router.push('/dashboard/reunions');
      }
      setLoading(false);
    };

    fetchAndSetReunion();
  }, [id, form, router, toast]);

  const handleParticipantAdd = (name: string) => {
    const currentParticipants = form.getValues("collaborateurs");
    const participantList = currentParticipants ? currentParticipants.split(',').map(p => p.trim()) : [];
    
    const existingNames = participantList.filter(p => p);

    if (!existingNames.includes(name)) {
        const newParticipants = existingNames.length > 0 ? [...existingNames, name].join(', ') : name;
        form.setValue("collaborateurs", newParticipants, { shouldValidate: true });
    }
  };

  async function onSubmit(data: ReunionFormValues) {
    setIsSubmitting(true)
    
    let supportUrl = existingSupportUrl || 'Aucun fichier';

    // Handle file upload if a new file is selected
    if (data.support && data.support.length > 0) {
        const file = data.support[0];
        const storageRef = ref(storage, `supports-reunions/${Date.now()}-${file.name}`);
        try {
            const uploadTask = await uploadBytes(storageRef, file);
            supportUrl = await getDownloadURL(uploadTask.ref);
        } catch (e) {
            console.error("Upload error:", e);
            toast({
                variant: "destructive",
                title: "Erreur de Téléversement",
                description: "Le nouveau fichier de support n'a pas pu être envoyé.",
            });
            setIsSubmitting(false);
            return;
        }
    }
    
    const { support, ...reunionData } = data;

    const dataToUpdate = {
        ...reunionData,
        supportUrl: supportUrl,
    };

    try {
      const docRef = doc(db, "reunions", id);
      await updateDoc(docRef, dataToUpdate);
      await logActivity(user, "Modification d'une réunion", { docId: id, objet: data.objet });
      toast({
        title: "Mise à Jour Réussie",
        description: "La réunion a été mise à jour.",
      })
      router.push(`/dashboard/reunions/${id}`)
    } catch (error) {
      console.error("Error updating document: ", error)
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre à jour la réunion. Veuillez réessayer.",
      })
    } finally {
        setIsSubmitting(false)
    }
  }

  if (loading) {
      return (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10" />
                <Skeleton className="h-7 w-96" />
            </div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="space-y-6">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
          </div>
      )
  }

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href={`/dashboard/reunions/${id}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Modifier la Réunion</h1>
            <p className="text-muted-foreground">
            Mettez à jour les informations de la réunion ci-dessous.
            </p>
        </div>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Détails de la Réunion</CardTitle>
              <CardDescription>Informations sur l'organisation de la réunion.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <FormField control={form.control} name="nature" render={({ field }) => (
                    <FormItem className="space-y-3">
                        <FormLabel>Nature de la réunion</FormLabel>
                        <FormControl>
                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex items-center gap-x-4">
                            <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl><RadioGroupItem value="presentielle" /></FormControl>
                                <FormLabel className="font-normal">Présentielle</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl><RadioGroupItem value="distancielle" /></FormControl>
                                <FormLabel className="font-normal">Distancielle</FormLabel>
                            </FormItem>
                        </RadioGroup>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="source" render={({ field }) => (
                        <FormItem><FormLabel>Source</FormLabel><FormControl><Input placeholder="Ex: Réunion mensuelle" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="objet" render={({ field }) => (
                        <FormItem><FormLabel>Objet</FormLabel><FormControl><Input placeholder="Objet de la réunion" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="date" render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Date de la réunion</FormLabel>
                            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                    {field.value ? format(field.value, "PPP") : <span>Choisir une date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={field.value} onSelect={(date) => {field.onChange(date); setIsDatePickerOpen(false);}} disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))} initialFocus />
                            </PopoverContent>
                          </Popover>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="heure" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Heure</FormLabel>
                             <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="HH:MM" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {timeSlots.map(time => <SelectItem key={time} value={time}>{time}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <FormField control={form.control} name="lieu" render={({ field }) => (
                        <FormItem><FormLabel>Lieu / Lien</FormLabel><FormControl><Input placeholder="Salle de réunion ou lien de la visio" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="animateur" render={({ field }) => (
                        <FormItem><FormLabel>Animateur</FormLabel><FormControl><Input placeholder="Nom de l'animateur" {...field} readOnly /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="duree" render={({ field }) => (
                        <FormItem><FormLabel>Durée</FormLabel><FormControl><Input placeholder="Ex: 60 minutes" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                 </div>
                 <FormField control={form.control} name="collaborateurs" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Collaborateurs concernés</FormLabel>
                        <FormControl><Textarea placeholder="Listez les noms ou cliquez sur les suggestions" {...field} /></FormControl>
                        <FormDescription>Séparez les noms par une virgule.</FormDescription>
                        <div className="pt-2 flex flex-wrap gap-1">
                            <span className="text-sm text-muted-foreground mr-2 py-1">Suggestions:</span>
                             {loadingLists ? <Skeleton className="h-6 w-48" /> : users.map(u => (
                                <Badge
                                    key={u.id}
                                    variant="secondary"
                                    className="cursor-pointer hover:bg-primary/20"
                                    onClick={() => handleParticipantAdd(u.displayName)}
                                    tabIndex={0}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleParticipantAdd(u.displayName); }}
                                >
                                    {u.displayName}
                                </Badge>
                            ))}
                        </div>
                        <FormMessage />
                    </FormItem>
                 )} />
                  <FormField control={form.control} name="support" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Support de réunion</FormLabel>
                        <FormControl>
                            <Input type="file" {...form.register("support")} />
                        </FormControl>
                        {existingSupportUrl && existingSupportUrl !== 'Aucun fichier' && (
                            <FormDescription>
                                Un fichier existe déjà. 
                                <a href={existingSupportUrl} target="_blank" rel="noopener noreferrer" className="underline text-accent ml-1">
                                  Voir le fichier actuel
                                </a>. 
                                Le remplacer en téléversant un nouveau.
                            </FormDescription>
                        )}
                        <FormMessage />
                    </FormItem>
                 )} />
                 <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem><FormLabel>Statut de la réunion</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un statut..." /></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="Planifiée">Planifiée</SelectItem>
                            <SelectItem value="Réalisée">Réalisée</SelectItem>
                            <SelectItem value="Annulée">Annulée</SelectItem>
                        </SelectContent>
                        </Select><FormMessage />
                    </FormItem>
                 )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
                <CardTitle>Compte Rendu</CardTitle>
                <CardDescription>Rédigez ici le compte rendu de la réunion, les décisions prises et les points d'action.</CardDescription>
            </CardHeader>
            <CardContent>
                <FormField control={form.control} name="compteRendu" render={({ field }) => (
                    <FormItem>
                        <FormControl><Textarea placeholder="Commencez à rédiger..." rows={10} {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer les modifications
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
