
"use client"

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm } from "react-hook-form"
import * as z from "zod"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from '@/hooks/use-auth'
import { format } from "date-fns"
import { Calendar as CalendarIcon, PlusCircle, Trash2, ArrowLeft, Loader2 } from "lucide-react"
import { db } from "@/lib/firebase"
import { collection, addDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore"
import { AutocompleteInput } from '@/components/ui/autocomplete-input'
import { logActivity } from '@/lib/activityLogger'


const chasseAuxAnomaliesSchema = z.object({
  date: z.date({ required_error: "La date est requise." }),
  activite: z.string().min(1, "L'activité observée est requise."),
  zone: z.string().min(1, "La zone/unité est requise."),
  poste: z.string().min(1, "Le poste de travail est requis."),
  animateur: z.string().min(1, "L'animateur est requis."),
  garant: z.string().min(1, "Le garant est requis."),
  participants: z.string().min(1, "La liste des participants est requise."),
  anomalies: z.array(z.object({
    description: z.string().min(1, "La description est requise."),
    famille: z.string().min(1, "La famille de risque est requise."),
    criticite: z.enum(["Mineure", "Moyenne", "Majeure", "Critique"], { required_error: "La criticité est requise." }),
    actionsCorrectives: z.string().optional().default(''),
    responsable: z.string().optional().default(''),
    echeance: z.date().optional(),
    avancement: z.enum(["En cours", "Réalisée", "Non réalisée"], { required_error: "Le statut d'avancement est requis." }),
  })).min(1, "Au moins une anomalie doit être signalée."),
  commentaires: z.string().optional().default(''),
})

type ChasseAuxAnomaliesFormValues = z.infer<typeof chasseAuxAnomaliesSchema>

const criticites = ["Mineure", "Moyenne", "Majeure", "Critique"];
const statutsAvancement = ["En cours", "Réalisée", "Non réalisée"];

export default function NewChasseAuxAnomaliesPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false)
  const [openEcheancePopovers, setOpenEcheancePopovers] = React.useState<Record<number, boolean>>({})


  const [zones, setZones] = useState<string[]>([]);
  const [postes, setPostes] = useState<string[]>([]);
  const [activites, setActivites] = useState<string[]>([]);
  const [familles, setFamilles] = useState<string[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  
  const [users, setUsers] = useState<{ id: string, displayName: string }[]>([]);
  const userNames = React.useMemo(() => users.map(u => u.displayName), [users]);


  const form = useForm<ChasseAuxAnomaliesFormValues>({
    resolver: zodResolver(chasseAuxAnomaliesSchema),
    defaultValues: {
      animateur: user?.displayName || user?.email || '',
      date: new Date(),
      anomalies: [{ 
        description: '', 
        famille: '',
        criticite: 'Moyenne',
        avancement: 'En cours', 
        actionsCorrectives: '', 
        responsable: '',
        echeance: undefined
      }],
      participants: '',
      commentaires: '',
      garant: '',
    },
  })
  
  useEffect(() => {
    const fetchLists = async () => {
        setLoadingLists(true);
        try {
            const fetchData = async (collectionName: string) => {
                const q = query(collection(db, collectionName), where("actif", "==", true));
                const snapshot = await getDocs(q);
                return snapshot.docs.map(doc => doc.data().nom as string);
            };
            
            const fetchUsers = async () => {
                const usersCollection = collection(db, "users");
                const usersSnapshot = await getDocs(usersCollection);
                const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as { id: string, displayName: string }[];
                setUsers(usersList);
            };

            await Promise.all([
                fetchData("zonesDeTravail").then(setZones),
                fetchData("postesDeTravail").then(setPostes),
                fetchData("activitesObservees").then(setActivites),
                fetchData("famillesDeRisque").then(setFamilles),
                fetchUsers()
            ]);

        } catch (error) {
            console.error("Error fetching lists: ", error);
            toast({
                variant: "destructive",
                title: "Erreur de chargement",
                description: "Impossible de charger les listes de sélection.",
            });
        } finally {
            setLoadingLists(false);
        }
    };

    fetchLists();
  }, [toast]);


  const { fields: anomaliesFields, append: appendAnomalie, remove: removeAnomalie } = useFieldArray({
    name: "anomalies",
    control: form.control,
  })

  async function onSubmit(data: ChasseAuxAnomaliesFormValues) {
    if (!user) {
        toast({
            variant: "destructive",
            title: "Erreur d'authentification",
            description: "Vous devez être connecté pour soumettre un formulaire.",
        })
        return
    }
    setIsSubmitting(true)
    try {
      const newDocRef = await addDoc(collection(db, "chassesAuxAnomalies"), {
        ...data,
        createdBy: user.uid,
        userEmail: user.email,
        createdAt: serverTimestamp(),
        status: "Ouverte", // Initial status
      });
      await logActivity(user, "Création d'une Chasse aux Anomalies", { docId: newDocRef.id });
      toast({
        title: "Formulaire Soumis",
        description: "La Chasse Aux Anomalies (CAA) a été enregistrée.",
      })
      router.push('/dashboard/anomalies')
    } catch (error) {
      console.error("Error adding document: ", error)
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'enregistrer le formulaire. Veuillez réessayer.",
      })
    } finally {
        setIsSubmitting(false)
    }
  }
  
  async function onSaveDraft() {
    if (!user) {
        toast({
            variant: "destructive",
            title: "Erreur d'authentification",
            description: "Vous devez être connecté pour enregistrer un brouillon.",
        })
        return
    }
    setIsSubmitting(true)
    const data = form.getValues();
    try {
      const newDocRef = await addDoc(collection(db, "chassesAuxAnomalies"), {
        ...data,
        status: "Brouillon",
        createdBy: user.uid,
        userEmail: user.email,
        createdAt: serverTimestamp(),
      });
      await logActivity(user, "Enregistrement d'un brouillon de CAA", { docId: newDocRef.id });
      toast({
        title: "Brouillon Enregistré",
        description: "La CAA a été sauvegardée en tant que brouillon.",
      })
      router.push('/dashboard/anomalies')
    } catch (error) {
      console.error("Error saving draft: ", error)
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'enregistrer le brouillon. Veuillez réessayer.",
      })
    } finally {
        setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/anomalies"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Nouvelle Chasse Aux Anomalies / مطاردة شذوذ جديدة</h1>
            <p className="text-muted-foreground">
            Remplissez les informations ci-dessous pour créer une nouvelle CAA.
            </p>
        </div>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Informations Générales</CardTitle>
              <CardDescription>Détails sur le contexte de la Chasse Aux Anomalies.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date de la CAA</FormLabel>
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
                        <Calendar mode="single" selected={field.value} onSelect={(date) => {field.onChange(date); setIsDatePickerOpen(false);}} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} initialFocus />
                    </PopoverContent>
                  </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
              <FormField control={form.control} name="activite" render={({ field }) => (
                  <FormItem><FormLabel>Activité observée</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger disabled={loadingLists}><SelectValue placeholder={loadingLists ? "Chargement..." : "Sélectionner..."} /></SelectTrigger></FormControl>
                        <SelectContent>{activites.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              <FormField control={form.control} name="zone" render={({ field }) => (
                  <FormItem><FormLabel>Zone / Unité</FormLabel>
                     <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger disabled={loadingLists}><SelectValue placeholder={loadingLists ? "Chargement..." : "Sélectionner..."} /></SelectTrigger></FormControl>
                        <SelectContent>{zones.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              <FormField control={form.control} name="poste" render={({ field }) => (
                  <FormItem><FormLabel>Poste de travail</FormLabel>
                     <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger disabled={loadingLists}><SelectValue placeholder={loadingLists ? "Chargement..." : "Sélectionner..."} /></SelectTrigger></FormControl>
                        <SelectContent>{postes.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              <FormField control={form.control} name="animateur" render={({ field }) => (
                  <FormItem><FormLabel>Animateur</FormLabel><FormControl><Input {...field} readOnly /></FormControl><FormMessage /></FormItem>
                )} />
              <FormField control={form.control} name="garant" render={({ field }) => (
                  <FormItem><FormLabel>Garant</FormLabel>
                    <FormControl>
                      <AutocompleteInput
                        placeholder="Nom du garant de la zone"
                        suggestions={userNames}
                        value={field.value}
                        onChange={field.onChange}
                       />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              <FormField control={form.control} name="participants" render={({ field }) => (
                  <FormItem className="lg:col-span-3"><FormLabel>Participants</FormLabel><FormControl><Textarea placeholder="Listez les noms des participants" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Anomalies Constatées</CardTitle>
              <CardDescription>Saisissez les écarts et les plans d'action associés.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {anomaliesFields.map((field, index) => (
                    <div key={field.id} className="p-4 border rounded-lg space-y-4 relative">
                        <h4 className="font-semibold">Anomalie n°{index + 1}</h4>
                        <FormField control={form.control} name={`anomalies.${index}.description`} render={({ field }) => (
                           <FormItem><FormLabel>Description de l'anomalie</FormLabel><FormControl><Textarea placeholder="Décrivez précisément l'anomalie..." {...field} /></FormControl><FormMessage /></FormItem>
                       )} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name={`anomalies.${index}.famille`} render={({ field }) => (
                               <FormItem><FormLabel>Famille de risque</FormLabel>
                                   <Select onValueChange={field.onChange} value={field.value}>
                                   <FormControl><SelectTrigger disabled={loadingLists}><SelectValue placeholder={loadingLists ? "Chargement..." : "Sélectionner..."} /></SelectTrigger></FormControl>
                                   <SelectContent>{familles.map(famille => <SelectItem key={famille} value={famille}>{famille}</SelectItem>)}</SelectContent>
                                   </Select><FormMessage />
                               </FormItem>
                           )} />
                           <FormField control={form.control} name={`anomalies.${index}.criticite`} render={({ field }) => (
                                <FormItem><FormLabel>Criticité</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl>
                                    <SelectContent>{criticites.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                                    </Select><FormMessage />
                                </FormItem>
                            )} />
                        </div>
                         <FormField control={form.control} name={`anomalies.${index}.actionsCorrectives`} render={({ field }) => (
                            <FormItem><FormLabel>Actions correctives</FormLabel><FormControl><Textarea placeholder="Quelles actions correctives sont prévues ?" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField control={form.control} name={`anomalies.${index}.responsable`} render={({ field }) => (
                                <FormItem><FormLabel>Responsable</FormLabel>
                                  <FormControl>
                                    <AutocompleteInput
                                      placeholder="Nom du responsable"
                                      suggestions={userNames}
                                      value={field.value || ''}
                                      onChange={field.onChange}
                                     />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`anomalies.${index}.echeance`} render={({ field }) => (
                                <FormItem className="flex flex-col"><FormLabel>Échéance</FormLabel>
                                <Popover open={openEcheancePopovers[index]} onOpenChange={(isOpen) => setOpenEcheancePopovers(prev => ({...prev, [index]: isOpen}))}>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                        {field.value ? format(field.value, "PPP") : <span>Choisir une date</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar mode="single" selected={field.value} onSelect={(date) => {field.onChange(date); setOpenEcheancePopovers(prev => ({...prev, [index]: false}))}} disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))} initialFocus />
                                </PopoverContent>
                              </Popover><FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`anomalies.${index}.avancement`} render={({ field }) => (
                                <FormItem><FormLabel>Avancement</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl>
                                    <SelectContent>{statutsAvancement.map(statut => <SelectItem key={statut} value={statut}>{statut}</SelectItem>)}</SelectContent>
                                    </Select><FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2" onClick={() => removeAnomalie(index)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => appendAnomalie({ description: '', famille: '', criticite: 'Moyenne', avancement: 'En cours', actionsCorrectives: '', responsable: '', echeance: undefined })}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Ajouter une anomalie
                </Button>
                 <FormField
                    control={form.control}
                    name="anomalies"
                    render={({ field }) => (
                        <FormItem>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader><CardTitle>Commentaires & Recommandations</CardTitle></CardHeader>
            <CardContent>
                <FormField control={form.control} name="commentaires" render={({ field }) => (
                    <FormItem><FormControl><Textarea placeholder="Ajoutez des commentaires ou recommandations générales..." rows={4} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="secondary" onClick={onSaveDraft} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer le brouillon
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
               {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Soumettre pour validation
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
