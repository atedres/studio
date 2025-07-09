
"use client"

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm, useFormContext } from "react-hook-form"
import * as z from "zod"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from '@/hooks/use-auth'
import { format } from "date-fns"
import { Calendar as CalendarIcon, PlusCircle, Trash2, ArrowLeft, Loader2, Wand2, Check, RefreshCcw, Undo2 } from "lucide-react"
import { db } from "@/lib/firebase"
import { doc, getDoc, updateDoc, Timestamp, collection, getDocs, query, where } from "firebase/firestore"
import { AutocompleteInput } from '@/components/ui/autocomplete-input'
import { logActivity } from '@/lib/activityLogger'
import { rewriteDescription } from '@/ai/flows/description-rewriter-flow'

const dialogueSecuriteSchema = z.object({
  date: z.date({ required_error: "La date est requise." }),
  observateur: z.string().min(1, "L'observateur est requis."),
  activite: z.string().min(1, "L'activité est requise."),
  zone: z.string().min(1, "La zone est requise."),
  poste: z.string().min(1, "Le poste est requis."),
  nombrePersonnes: z.coerce.number().min(1, "Le nombre de personnes est requis."),
  identification: z.string().min(1, "L'identification est requise."),
  comportementsPositifs: z.array(z.object({ value: z.string().min(1, "Ce champ est requis.") })).max(5),
  anomalies: z.array(z.object({
    type: z.enum(["AD", "IS", "SD"], { required_error: "Le type est requis." }),
    description: z.string().min(1, "La description est requise."),
    familleRisque: z.string().min(1, "La famille de risque est requise."),
    actionsImmediates: z.array(z.object({ value: z.string().min(1, "L'action immédiate ne peut être vide.") })).optional(),
    actionsCorrectives: z.string().optional(),
    echeance: z.date().optional(),
    garant: z.string().optional(),
    responsable: z.string().optional(),
    statut: z.enum(["En cours", "Réalisée", "Non réalisée"], { required_error: "Le statut est requis." }),
  })),
  commentaires: z.string().optional(),
})

type DialogueSecuriteFormValues = z.infer<typeof dialogueSecuriteSchema>

const bonnesPratiques = [
    "Port des EPI conforme",
    "Utilisation correcte des outils",
    "Respect des procédures de consignation (LOTO)",
    "Maintien de l'ordre et de la propreté (5S)",
    "Posture de travail adéquate",
    "Autre",
];

const ActionsImmediatesArray = ({ nestIndex, control }: { nestIndex: number; control: any }) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `anomalies.${nestIndex}.actionsImmediates`,
  });

  return (
    <div className="space-y-3 pl-4 border-l-2 ml-2 py-2">
        <FormLabel>Actions immédiates</FormLabel>
        {fields.map((item, k) => (
            <FormField
            key={item.id}
            control={control}
            name={`anomalies.${nestIndex}.actionsImmediates.${k}.value`}
            render={({ field }) => (
                <FormItem>
                <div className="flex items-center gap-2">
                    <FormControl>
                    <Textarea placeholder={`Action immédiate n°${k + 1}`} {...field} rows={1} />
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
            Ajouter une action
        </Button>
    </div>
  );
};


export default function EditDialogueSecuritePage() {
    const { toast } = useToast()
    const router = useRouter()
    const params = useParams()
    const id = params.id as string
    const { user } = useAuth();

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [loading, setLoading] = useState(true)
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
    const [openEcheancePopovers, setOpenEcheancePopovers] = useState<Record<number, boolean>>({})

    const [zones, setZones] = useState<string[]>([]);
    const [postes, setPostes] = useState<string[]>([]);
    const [activites, setActivites] = useState<string[]>([]);
    const [familles, setFamilles] = useState<string[]>([]);
    const [loadingLists, setLoadingLists] = useState(true);

    const [users, setUsers] = useState<{ id: string, displayName: string }[]>([]);
    const userNames = React.useMemo(() => users.map(u => u.displayName), [users]);
    
    const [customBP, setCustomBP] = useState<Record<number, boolean>>({});
    const [aiRewriteStates, setAiRewriteStates] = useState<Record<number, { isRewriting: boolean; originalText: string; suggestion: string }>>({});


    const form = useForm<DialogueSecuriteFormValues>({
        resolver: zodResolver(dialogueSecuriteSchema),
        defaultValues: {},
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

    useEffect(() => {
        if (!id) return;

        const fetchAndSetDS = async () => {
            setLoading(true);
            const docRef = doc(db, "dialoguesSecurite", id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                
                // Initialize customBP state based on loaded data
                const initialCustomBP: Record<number, boolean> = {};
                if (data.comportementsPositifs && Array.isArray(data.comportementsPositifs)) {
                    data.comportementsPositifs.forEach((comp: { value: string }, index: number) => {
                        if (!bonnesPratiques.includes(comp.value)) {
                            initialCustomBP[index] = true;
                        }
                    });
                }
                setCustomBP(initialCustomBP);

                const transformedData = {
                    ...data,
                    date: (data.date as Timestamp).toDate(),
                    anomalies: data.anomalies.map((anomalie: any) => ({
                        ...anomalie,
                        echeance: anomalie.echeance ? (anomalie.echeance as Timestamp).toDate() : undefined,
                        actionsImmediates: anomalie.actionsImmediates || [],
                    })),
                };
                form.reset(transformedData as DialogueSecuriteFormValues);
            } else {
                toast({
                    variant: "destructive",
                    title: "Erreur",
                    description: "Le document demandé n'existe pas.",
                });
                router.push('/dashboard/audits');
            }
            setLoading(false);
        };

        fetchAndSetDS();
    }, [id, form, router, toast]);

    const { fields: comportementsFields, append: appendComportement, remove: removeComportement } = useFieldArray({
        name: "comportementsPositifs",
        control: form.control,
    })

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


    async function onSubmit(data: DialogueSecuriteFormValues) {
        setIsSubmitting(true)
        try {
            const docRef = doc(db, "dialoguesSecurite", id);
            await updateDoc(docRef, { ...data });
            await logActivity(user, "Modification d'un Dialogue Sécurité", { docId: id });
            toast({
                title: "Mise à Jour Réussie",
                description: "Le Dialogue Sécurité a été mis à jour.",
            })
            router.push(`/dashboard/audits/${id}`)
        } catch (error) {
            console.error("Error updating document: ", error)
            toast({
                variant: "destructive",
                title: "Erreur",
                description: "Impossible de mettre à jour le formulaire. Veuillez réessayer.",
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
                <Skeleton className="h-[400px] w-full" />
                <Skeleton className="h-[300px] w-full" />
                <Skeleton className="h-[450px] w-full" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href={`/dashboard/audits/${id}`}><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline">Modifier le Dialogue Sécurité</h1>
                    <p className="text-muted-foreground">Mettez à jour les informations ci-dessous.</p>
                </div>
            </div>
      
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Informations Générales</CardTitle>
                            <CardDescription>Détails sur le contexte du dialogue.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                             <FormField control={form.control} name="date" render={({ field }) => (
                                <FormItem className="flex flex-col"><FormLabel>Date du dialogue</FormLabel>
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
                            <FormField control={form.control} name="observateur" render={({ field }) => (
                                <FormItem><FormLabel>Observateur</FormLabel><FormControl><Input {...field} readOnly /></FormControl><FormMessage /></FormItem>
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
                            <FormField control={form.control} name="nombrePersonnes" render={({ field }) => (
                                <FormItem><FormLabel>Nombre de personnes</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="identification" render={({ field }) => (
                                 <FormItem><FormLabel>Identification (Nom ou matricule)</FormLabel>
                                    <FormControl>
                                        <AutocompleteInput
                                          placeholder="Nom ou matricule de la personne observée"
                                          suggestions={userNames}
                                          value={field.value}
                                          onChange={field.onChange}
                                       />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                            )} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Comportements Positifs Observés</CardTitle><CardDescription>Listez les bonnes pratiques de sécurité constatées.</CardDescription></CardHeader>
                         <CardContent className="space-y-4">
                            {comportementsFields.map((field, index) => (
                                <FormField key={field.id} control={form.control} name={`comportementsPositifs.${index}.value`} render={({ field: formField }) => (
                                    <FormItem>
                                        <div className="flex items-center gap-2">
                                            <Select
                                                onValueChange={(value) => {
                                                    if (value === 'Autre') {
                                                        setCustomBP(prev => ({ ...prev, [index]: true }));
                                                        formField.onChange('');
                                                    } else {
                                                        setCustomBP(prev => ({ ...prev, [index]: false }));
                                                        formField.onChange(value);
                                                    }
                                                }}
                                                value={customBP[index] ? 'Autre' : bonnesPratiques.includes(formField.value) ? formField.value : 'Autre'}
                                            >
                                                <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner ou saisir..." /></SelectTrigger></FormControl>
                                                <SelectContent>{bonnesPratiques.map(bp => <SelectItem key={bp} value={bp}>{bp}</SelectItem>)}</SelectContent>
                                            </Select>
                                            {customBP[index] && (
                                                <FormControl><Input placeholder="Précisez la bonne pratique..." {...formField} /></FormControl>
                                            )}
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeComportement(index)} disabled={comportementsFields.length <= 1}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={() => appendComportement({ value: bonnesPratiques[0] })} disabled={comportementsFields.length >= 5}><PlusCircle className="mr-2 h-4 w-4" />Ajouter un comportement</Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Anomalies Constatées</CardTitle><CardDescription>Saisissez les écarts par rapport aux règles de sécurité.</CardDescription></CardHeader>
                        <CardContent className="space-y-6">
                            {anomaliesFields.map((field, index) => (
                                <div key={field.id} className="p-4 border rounded-lg space-y-4 relative">
                                    <h4 className="font-semibold">Anomalie n°{index + 1}</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                       <FormField control={form.control} name={`anomalies.${index}.type`} render={({ field }) => (<FormItem><FormLabel>Type d'anomalie</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="AD">Acte Dangereux (AD)</SelectItem><SelectItem value="IS">Situation Dangereuse (IS)</SelectItem><SelectItem value="SD">Système Défaillant (SD)</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name={`anomalies.${index}.familleRisque`} render={({ field }) => (<FormItem><FormLabel>Famille de risque</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger disabled={loadingLists}><SelectValue placeholder={loadingLists ? "Chargement..." : "Sélectionner..."} /></SelectTrigger></FormControl>
                                                <SelectContent>{familles.map(famille => <SelectItem key={famille} value={famille}>{famille}</SelectItem>)}</SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>)} />
                                    </div>
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

                                    <ActionsImmediatesArray nestIndex={index} control={form.control} />
                                    
                                    <h5 className="font-medium pt-2">Plan d'action correctif</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                                         <FormField control={form.control} name={`anomalies.${index}.garant`} render={({ field }) => (
                                            <FormItem><FormLabel>Garant</FormLabel>
                                               <FormControl>
                                                 <AutocompleteInput
                                                    placeholder="Nom du garant"
                                                    suggestions={userNames}
                                                    value={field.value || ''}
                                                    onChange={field.onChange}
                                                 />
                                               </FormControl>
                                               <FormMessage />
                                            </FormItem>
                                         )} />
                                        <FormField control={form.control} name={`anomalies.${index}.echeance`} render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Échéance</FormLabel>
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
                                          </Popover>
                                          <FormMessage />
                                        </FormItem>)} />
                                        <FormField control={form.control} name={`anomalies.${index}.statut`} render={({ field }) => (<FormItem><FormLabel>Statut</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="En cours">En cours</SelectItem><SelectItem value="Réalisée">Réalisée</SelectItem><SelectItem value="Non réalisée">Non réalisée</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                    </div>
                                    <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2" onClick={() => removeAnomalie(index)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={() => appendAnomalie({ type: 'AD', description: '', familleRisque: '', statut: 'En cours', actionsImmediates: [], actionsCorrectives: '', responsable: '', garant: '' })}><PlusCircle className="mr-2 h-4 w-4" />Ajouter une anomalie</Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Commentaires & Recommandations</CardTitle></CardHeader>
                        <CardContent><FormField control={form.control} name="commentaires" render={({ field }) => (<FormItem><FormControl><Textarea placeholder="Ajoutez des commentaires ou recommandations générales..." rows={4} {...field} /></FormControl><FormMessage /></FormItem>)} /></CardContent>
                    </Card>

                    <div className="flex justify-end gap-4">
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
