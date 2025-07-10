
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
import { Calendar as CalendarIcon, PlusCircle, Trash2, ArrowLeft, Loader2, AlertTriangle, Wand2, RefreshCcw, Check, Undo2, X } from "lucide-react"
import { db } from "@/lib/firebase"
import { collection, addDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore"
import { AutocompleteInput } from '@/components/ui/autocomplete-input'
import { logActivity } from '@/lib/activityLogger'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { rewriteDescription } from '@/ai/flows/description-rewriter-flow'
import { Badge } from '@/components/ui/badge'


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
    actionsCorrectives: z.array(z.object({ value: z.string().min(1, "L'action corrective ne peut être vide.") })).optional(),
    responsable: z.string().optional().default(''),
    echeance: z.date().optional(),
    avancement: z.enum(["En cours", "Réalisée", "Non réalisée"], { required_error: "Le statut d'avancement est requis." }),
  })).min(1, "Au moins une anomalie doit être signalée."),
  commentaires: z.string().optional().default(''),
})

type ChasseAuxAnomaliesFormValues = z.infer<typeof chasseAuxAnomaliesSchema>

const CorrectiveActionsArray = ({ nestIndex, control }: { nestIndex: number; control: any }) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `anomalies.${nestIndex}.actionsCorrectives`,
  });

  return (
    <div className="space-y-3 pl-4 border-l-2 ml-2 py-2">
      <FormLabel>Actions correctives</FormLabel>
      {fields.map((item, k) => (
        <FormField
          key={item.id}
          control={control}
          name={`anomalies.${nestIndex}.actionsCorrectives.${k}.value`}
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-2">
                <FormControl>
                  <Textarea placeholder={`Action corrective n°${k + 1}`} {...field} rows={1} />
                </FormControl>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(k)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ value: "" })}
      >
        <PlusCircle className="mr-2 h-4 w-4" />
        Ajouter une action corrective
      </Button>
    </div>
  );
};


const criticites = ["Mineure", "Moyenne", "Majeure", "Critique"];
const statutsAvancement = ["En cours", "Réalisée", "Non réalisée"];

export default function NewChasseAuxAnomaliesPage() {
  const { toast } = useToast()
  const { user, isDemoMode } = useAuth()
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

  const [aiRewriteStates, setAiRewriteStates] = useState<Record<number, { isRewriting: boolean; originalText: string; suggestion: string }>>({});
  const [participantInput, setParticipantInput] = useState('');


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
        actionsCorrectives: [], 
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

    if (!isDemoMode) {
      fetchLists();
    } else {
      setLoadingLists(false);
    }
  }, [toast, isDemoMode]);


  const { fields: anomaliesFields, append: appendAnomalie, remove: removeAnomalie } = useFieldArray({
    name: "anomalies",
    control: form.control,
  })

  const handleRewrite = async (index: number) => {
    const currentDescription = form.getValues(`anomalies.${index}.description`);
    if (!currentDescription) return;

    setAiRewriteStates(prev => ({
        ...prev,
        [index]: { ...prev[index], isRewriting: true, originalText: currentDescription, suggestion: '' }
    }));

    try {
        const rewrittenText = await rewriteDescription(currentDescription);
        setAiRewriteStates(prev => ({
            ...prev,
            [index]: { ...prev[index], isRewriting: false, suggestion: rewrittenText }
        }));
        form.setValue(`anomalies.${index}.description`, rewrittenText);
    } catch (error) {
        console.error("Rewrite error:", error);
        toast({ variant: "destructive", title: "Erreur IA", description: "La reformulation a échoué." });
        setAiRewriteStates(prev => ({ ...prev, [index]: { ...prev[index], isRewriting: false } }));
    }
  };

  const acceptSuggestion = (index: number) => {
      setAiRewriteStates(prev => {
          const newStates = { ...prev };
          delete newStates[index];
          return newStates;
      });
  };

  const revertDescription = (index: number) => {
      const originalText = aiRewriteStates[index]?.originalText;
      if (originalText) {
          form.setValue(`anomalies.${index}.description`, originalText);
      }
      acceptSuggestion(index); // This just clears the state
  };

  const handleParticipantInputChange = (newValue: string) => {
    const selectedSuggestion = userNames.find(name => name === newValue);
    if (selectedSuggestion) {
        const currentParticipants = form.getValues("participants") || "";
        const participantList = currentParticipants.split(',').map(p => p.trim()).filter(p => p);
        if (!participantList.includes(selectedSuggestion)) {
            form.setValue("participants", [...participantList, selectedSuggestion].join(', '), { shouldValidate: true });
        }
        setParticipantInput('');
    } else {
        setParticipantInput(newValue);
    }
  };

  const handleRemoveParticipant = (nameToRemove: string) => {
      const currentParticipants = form.getValues("participants");
      const participantList = currentParticipants.split(',').map(p => p.trim()).filter(p => p);
      const newParticipants = participantList.filter(p => p !== nameToRemove).join(', ');
      form.setValue("participants", newParticipants, { shouldValidate: true });
  };


  async function onSubmit(data: ChasseAuxAnomaliesFormValues) {
    if (isDemoMode) {
        toast({ title: "Mode Démo", description: "La soumission est désactivée en mode démo." });
        return;
    }
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
    if (isDemoMode) {
        toast({ title: "Mode Démo", description: "La sauvegarde est désactivée en mode démo." });
        return;
    }
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
       {isDemoMode && (
          <Alert variant="default" className="bg-yellow-100 border-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-700">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertTitle className="text-yellow-800 dark:text-yellow-300">Mode Démonstration</AlertTitle>
            <AlertDescription className="text-yellow-700 dark:text-yellow-400">
              Vous êtes en mode démo. Les formulaires ne peuvent pas être soumis ou sauvegardés.
            </AlertDescription>
          </Alert>
      )}
      
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
              <FormField control={form.control} name="participants" render={({ field }) => {
                     const selectedParticipants = field.value ? field.value.split(',').map(p => p.trim()).filter(Boolean) : [];
                     return (
                      <FormItem className="lg:col-span-3">
                        <FormLabel>Participants</FormLabel>
                         <div className="rounded-md border min-h-[40px] p-2 flex flex-wrap gap-2">
                            {selectedParticipants.length > 0 ? selectedParticipants.map(name => (
                                <Badge key={name} variant="secondary" className="flex items-center gap-1">
                                    {name}
                                    <button type="button" onClick={() => handleRemoveParticipant(name)} className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2">
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            )) : <span className="text-sm text-muted-foreground px-1">Aucun participant ajouté.</span>}
                        </div>
                        <AutocompleteInput
                            placeholder="Rechercher une personne à ajouter..."
                            suggestions={userNames.filter(u => !selectedParticipants.includes(u))}
                            value={participantInput}
                            onChange={handleParticipantInputChange}
                        />
                        <FormMessage />
                      </FormItem>
                    )}} />
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
                        <FormField control={form.control} name={`anomalies.${index}.description`} render={({ field: descriptionField }) => (
                           <FormItem>
                            <FormLabel>Description de l'anomalie</FormLabel>
                            <FormControl><Textarea placeholder="Décrivez précisément l'anomalie..." {...descriptionField} /></FormControl>
                             <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <Button type="button" size="sm" variant="outline" onClick={() => handleRewrite(index)} disabled={aiRewriteStates[index]?.isRewriting || !descriptionField.value}>
                                        {aiRewriteStates[index]?.isRewriting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                        Reformuler
                                    </Button>
                                    {aiRewriteStates[index]?.suggestion && (
                                        <>
                                            <Button type="button" size="sm" variant="ghost" className="text-green-600 hover:text-green-700" onClick={() => acceptSuggestion(index)}><Check className="mr-2 h-4 w-4"/> Accepter</Button>
                                            <Button type="button" size="sm" variant="ghost" onClick={() => handleRewrite(index)}><RefreshCcw className="mr-2 h-4 w-4"/> Réessayer</Button>
                                            <Button type="button" size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => revertDescription(index)}><Undo2 className="mr-2 h-4 w-4"/> Annuler</Button>
                                        </>
                                    )}
                                </div>
                                <FormMessage />
                            </div>
                           </FormItem>
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
                         
                        <CorrectiveActionsArray nestIndex={index} control={form.control} />
                        
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
                <Button type="button" variant="outline" size="sm" onClick={() => appendAnomalie({ description: '', famille: '', criticite: 'Moyenne', avancement: 'En cours', actionsCorrectives: [], responsable: '', echeance: undefined })}>
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
            <Button type="button" variant="secondary" onClick={onSaveDraft} disabled={isSubmitting || isDemoMode}>
              {isSubmitting && !isDemoMode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer le brouillon
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting || isDemoMode}>
               {isSubmitting && !isDemoMode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Soumettre pour validation
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
