/**
 * Tiny hand-written umbrella lexicon for the closeness recap: when a player guesses a broad class
 * ("animals", "food", "instruments"), we check how many of the category's member words belong to it.
 * Each line: guess aliases | member vocabulary. Words are stemmed at load, so plurals don't matter.
 * Original content for this project.
 */
const SRC = `
animal,creature,beast,wildlife,mammal,critter,pet,fauna,zoo,species|dog,cat,tiger,zebra,lion,bear,wolf,fox,horse,cow,pig,sheep,goat,ram,bull,rhino,elephant,giraffe,monkey,ape,gorilla,chimp,kangaroo,koala,panda,skunk,squirrel,rabbit,bunny,hare,mouse,rat,hamster,hedgehog,porcupine,bat,deer,moose,elk,camel,llama,donkey,mule,zebra,leopard,cheetah,jaguar,panther,cougar,lynx,hyena,otter,beaver,badger,raccoon,seal,walrus,whale,dolphin,shark,fish,salmon,trout,tuna,cod,eel,octopus,squid,crab,lobster,shrimp,oyster,clam,snail,slug,starfish,jellyfish,turtle,tortoise,lizard,snake,cobra,python,crocodile,alligator,frog,toad,chameleon,iguana,gecko,dragon,unicorn,bird,owl,eagle,hawk,crow,raven,parrot,penguin,ostrich,emu,swan,duck,goose,chicken,hen,rooster,turkey,peacock,pigeon,dove,flamingo,bee,wasp,ant,spider,butterfly,moth,ladybug,beetle,fly,mosquito,cricket,grasshopper,worm,anteater,sloth,armadillo,hippo,buffalo,bison,ox,yak,mole,weasel,ferret,mink,puma,dalmatian,poodle,beagle,terrier,labrador,bulldog,kitten,puppy,calf,lamb,foal,cub
bird,fowl,poultry,avian|owl,eagle,hawk,crow,raven,parrot,penguin,ostrich,emu,kiwi,swan,duck,goose,chicken,hen,rooster,turkey,peacock,pigeon,dove,flamingo,robin,sparrow,finch,wren,jay,cardinal,falcon,vulture,condor,pelican,stork,heron,crane,gull,puffin,toucan,hummingbird,woodpecker,dodo,albatross,canary,magpie,starling,lark,kingfisher,cuckoo
insect,bug,creepy crawly|bee,wasp,hornet,ant,butterfly,moth,ladybug,beetle,fly,mosquito,cricket,grasshopper,locust,dragonfly,termite,flea,tick,louse,cockroach,firefly,caterpillar,cicada,mantis,spider,scorpion
sea,ocean,marine,aquatic,water,underwater|fish,shark,whale,dolphin,seal,walrus,octopus,squid,crab,lobster,shrimp,oyster,clam,mussel,starfish,jellyfish,coral,seahorse,eel,turtle,salmon,tuna,cod,sardine,anchovy,urchin,sponge,seaweed,ship,boat,submarine,wave,tide,reef,shell,pearl,anchor,sail
food,dish,meal,snack,cuisine,eat,edible,grocery,groceries,ingredient,cooking,meat,dessert,sweet,treat|bread,cheese,pizza,pasta,rice,bean,egg,bacon,ham,sausage,burger,sandwich,taco,burrito,sushi,soup,salad,steak,chicken,turkey,fish,shrimp,crab,lobster,oyster,noodle,spaghetti,lasagna,ravioli,penne,pie,cake,cookie,muffin,donut,bagel,croissant,pancake,waffle,toast,cereal,oatmeal,yogurt,butter,cream,milk,chocolate,candy,caramel,toffee,fudge,jelly,jam,honey,syrup,sugar,salt,pepper,mustard,ketchup,mayo,sauce,gravy,curry,chili,stew,pudding,custard,popcorn,chip,fries,pretzel,cracker,nut,peanut,almond,walnut,cashew,olive,pickle,onion,garlic,potato,tomato,carrot,pea,corn,apple,banana,orange,lemon,lime,grape,cherry,berry,strawberry,blueberry,raspberry,melon,watermelon,peach,pear,plum,mango,pineapple,coconut,kiwi,fig,date,avocado,mushroom,lettuce,cabbage,spinach,broccoli,cucumber,pumpkin,squash,tofu,hummus,falafel,kebab,dumpling,omelette,quiche,crepe,brownie,cupcake,scone,biscuit,brioche,baguette,pita,naan,tortilla,nacho,salsa,guacamole,feta,brie,cheddar,gouda,mozzarella,parmesan,pepperoni,anchovy,sundae,sorbet,gelato,marshmallow,licorice,gum,lollipop,truffle,macaron,eclair,tart,cinnamon,vanilla,ginger,mint,basil,herb,spice,flour,dough,crust,cone,kale,beet,radish,celery,leek,yam,turnip,parsnip,artichoke,asparagus,zucchini,eggplant,okra
fruit|apple,banana,orange,lemon,lime,grape,cherry,berry,strawberry,blueberry,raspberry,blackberry,cranberry,gooseberry,elderberry,mulberry,melon,watermelon,cantaloupe,peach,pear,plum,prune,apricot,mango,pineapple,coconut,kiwi,fig,date,avocado,pomegranate,papaya,guava,lychee,passion fruit,grapefruit,tangerine,clementine,nectarine,olive,tomato,raisin,currant,quince,persimmon,starfruit,dragon fruit,jackfruit,durian
vegetable,veggie,veg,greens,produce|potato,tomato,carrot,pea,corn,onion,garlic,lettuce,cabbage,spinach,broccoli,cauliflower,cucumber,pumpkin,squash,pepper,kale,beet,radish,celery,leek,yam,turnip,parsnip,artichoke,asparagus,zucchini,eggplant,okra,bean,sprout,shallot,chard,rhubarb,mushroom
drink,beverage,booze,alcohol,cocktail,liquor,juice|water,milk,tea,coffee,latte,espresso,cappuccino,mocha,soda,cola,lemonade,juice,wine,beer,ale,lager,cider,whiskey,whisky,vodka,gin,rum,tequila,brandy,champagne,prosecco,sake,martini,margarita,mojito,sangria,punch,smoothie,shake,cocoa,chai,kombucha,port,sherry,bourbon,scotch,absinthe
body,anatomy,organ,limb|head,face,eye,ear,nose,mouth,lip,tongue,tooth,teeth,chin,cheek,jaw,neck,throat,shoulder,arm,elbow,wrist,hand,finger,thumb,nail,chest,back,spine,stomach,belly,hip,leg,knee,ankle,foot,toe,heel,skin,hair,brain,heart,lung,liver,kidney,bone,rib,skull,muscle,blood,vein,palm,shin,calf,thigh,waist,navel,eyebrow,eyelash,lid,pupil,iris,forehead,temple,nostril,gum
clothing,clothes,apparel,garment,outfit,wear,fashion,attire,wardrobe,accessory|shirt,t-shirt,blouse,sweater,jumper,hoodie,sweatshirt,jacket,coat,parka,blazer,suit,tuxedo,vest,dress,skirt,gown,robe,pants,trousers,jeans,shorts,leggings,sock,shoe,boot,sneaker,sandal,slipper,heel,hat,cap,beanie,beret,helmet,scarf,glove,mitten,tie,bowtie,belt,bra,underwear,pajamas,apron,uniform,kimono,sari,kilt,poncho,cape,cardigan,tank top,hood,collar,sleeve,button,zipper,lace,pocket
vehicle,transport,transportation,car,ride,wheel,travel|car,bus,truck,van,taxi,cab,train,tram,subway,bike,bicycle,motorcycle,scooter,plane,jet,helicopter,boat,ship,yacht,canoe,kayak,raft,ferry,submarine,rocket,tractor,tank,ambulance,limo,sled,sleigh,skateboard,wagon,cart,carriage,trolley,blimp,balloon,glider,jeep,sedan,convertible
tool,equipment,gadget,device,utensil,implement,hardware|hammer,saw,drill,screwdriver,wrench,pliers,chisel,axe,shovel,spade,rake,hoe,trowel,level,tape,ruler,file,clamp,vise,knife,scissors,needle,pin,nail,screw,bolt,nut,gear,lever,pulley,ladder,brush,broom,mop,bucket,comb,razor,tweezers,spatula,whisk,ladle,fork,spoon,tongs,grater,peeler,corkscrew,compass,protractor,crowbar,sledgehammer,mallet
instrument,music,musical,band,orchestra,song|piano,guitar,violin,viola,cello,bass,harp,drum,flute,clarinet,oboe,bassoon,saxophone,trumpet,trombone,tuba,horn,bugle,harmonica,accordion,banjo,ukulele,mandolin,organ,keyboard,synth,xylophone,triangle,tambourine,cymbal,bagpipe,recorder,sitar,lute,kazoo,maraca,bell,gong,note,scale,chord,melody,rhythm,tempo,beat,record,album,song,playlist,rock,jazz,blues,pop,rap,hip hop,punk,metal,reggae,disco,soul,funk,opera,folk,country
sport,game,athletic,athlete,team,olympic|football,soccer,baseball,basketball,tennis,golf,hockey,rugby,cricket,volleyball,badminton,boxing,wrestling,judo,karate,fencing,archery,cycling,rowing,sailing,surfing,skiing,snowboarding,skating,swimming,diving,running,marathon,sprint,relay,hurdle,javelin,discus,polo,lacrosse,softball,bowling,darts,snooker,billiards,pool,squash,handball,netball,gymnastics,triathlon,chess,poker,bridge,checkers,monopoly,scrabble,tag,hopscotch,dodgeball,kickball,ball,bat,racket,puck,goal,net,wicket,club,tee
color,colour,shade,hue,paint,pigment|red,orange,yellow,green,blue,purple,violet,indigo,pink,brown,black,white,gray,grey,silver,gold,beige,tan,cream,ivory,navy,teal,turquoise,cyan,magenta,maroon,crimson,scarlet,lavender,lilac,mauve,coral,peach,salmon,olive,lime,mint,amber,ruby,emerald,sapphire,jade,charcoal,khaki,burgundy,rose,cherry,plum,lemon,sky,ocean,forest,sand
country,nation,state,place,geography,location,world,capital,city,town,continent,land,region|france,spain,italy,germany,england,britain,scotland,wales,ireland,portugal,greece,turkey,russia,china,japan,india,korea,thailand,vietnam,egypt,morocco,kenya,nigeria,ghana,brazil,argentina,chile,peru,mexico,canada,cuba,jamaica,chad,mali,togo,oman,iran,iraq,israel,jordan,syria,norway,sweden,finland,denmark,iceland,poland,austria,hungary,belgium,holland,netherlands,switzerland,australia,zealand,america,usa,paris,london,rome,madrid,berlin,tokyo,beijing,moscow,cairo,athens,dublin,lisbon,vienna,prague,sydney,toronto,chicago,boston,dallas,denver,miami,seattle,houston,phoenix,florida,texas,georgia,california,york,vegas,asia,europe,africa,antarctica
job,profession,occupation,career,worker,trade,role|doctor,nurse,teacher,lawyer,judge,chef,cook,baker,butcher,farmer,pilot,driver,captain,sailor,soldier,police,officer,detective,firefighter,plumber,carpenter,electrician,mechanic,engineer,architect,artist,painter,writer,author,poet,actor,singer,dancer,musician,dentist,vet,surgeon,scientist,banker,accountant,clerk,cashier,waiter,butler,maid,nanny,tailor,barber,miner,builder,postman,mailman,referee,coach,priest,nun,monk,king,queen,prince,princess,president,senator,mayor
plant,flower,tree,botany,garden,nature,flora,leaf,greenery|rose,tulip,daisy,lily,orchid,sunflower,daffodil,poppy,violet,iris,lotus,jasmine,lavender,dandelion,clover,ivy,fern,moss,cactus,bamboo,grass,weed,oak,pine,birch,maple,willow,elm,ash,cedar,palm,fir,spruce,redwood,cypress,beech,holly,mistletoe,vine,shrub,bush,hedge,seed,root,stem,bark,branch,trunk,thorn,petal,pollen,herb,basil,mint,sage,thyme
furniture,household,home,house,room,decor|table,chair,sofa,couch,bed,desk,stool,bench,shelf,cabinet,cupboard,wardrobe,dresser,drawer,mirror,lamp,rug,carpet,curtain,blind,pillow,cushion,blanket,sheet,mattress,crib,cot,ottoman,armchair,recliner,bookcase,sink,tub,bath,shower,toilet,oven,stove,fridge,microwave,kettle,toaster,door,window,roof,wall,floor,ceiling,stair,attic,basement,garage,kitchen,bedroom,bathroom,closet,chimney,fireplace
weather,climate,forecast,sky|rain,snow,sleet,hail,fog,mist,cloud,storm,thunder,lightning,wind,breeze,gale,hurricane,tornado,cyclone,typhoon,blizzard,drizzle,shower,sunshine,sun,frost,ice,heat,humidity,rainbow,monsoon,drought,flood
space,astronomy,cosmos,universe,galaxy,celestial,heavens|sun,moon,star,planet,comet,asteroid,meteor,galaxy,nebula,mercury,venus,earth,mars,jupiter,saturn,uranus,neptune,pluto,orbit,rocket,astronaut,satellite,telescope,eclipse,constellation,black hole,supernova
shape,geometry,figure,form|circle,square,triangle,rectangle,oval,diamond,star,heart,cross,crescent,hexagon,pentagon,octagon,cube,sphere,cone,cylinder,pyramid,prism,spiral,arrow,ring,line,curve,arc
number,math,maths,mathematics,numeral,digit,count,figure|one,two,three,four,five,six,seven,eight,nine,ten,eleven,twelve,dozen,hundred,thousand,million,billion,zero,half,quarter,pi,prime,square,cube,sum,total,pair,trio,single,double,triple
metal,material,element,substance,mineral,rock,stone,gem,jewel|gold,silver,copper,iron,steel,tin,lead,zinc,nickel,aluminum,platinum,titanium,chrome,brass,bronze,mercury,uranium,cobalt,wood,glass,plastic,paper,cotton,wool,silk,leather,rubber,stone,marble,granite,clay,concrete,diamond,ruby,emerald,sapphire,pearl,opal,jade,amber,crystal,quartz,coal,salt,sand
weapon,military,war,army,battle,fight,combat|sword,knife,dagger,spear,axe,bow,arrow,gun,rifle,pistol,cannon,bomb,grenade,missile,tank,shield,armor,helmet,club,mace,whip,bullet,shell,torpedo,sling,catapult,crossbow,lance
toy,childhood,kid,children,play,playground|doll,ball,kite,yo-yo,puzzle,block,lego,teddy,bear,top,marble,rattle,slinky,frisbee,balloon,swing,slide,seesaw,trampoline,jigsaw,robot,train,puppet
`;

import { tokenize } from './match';

export interface UmbrellaClass {
  aliases: Set<string>;
  vocab: Set<string>;
}

/** Umbrella-class evidence for the closeness recap, bound to one language's data. */
export interface Lexicon {
  umbrellaFraction(token: string, memberTokens: readonly (readonly string[])[]): number;
  siblingFraction(token: string, memberTokens: readonly (readonly string[])[]): number;
}

/** Parse `aliases | vocabulary` lines with a language's tokenizer. */
export function parseUmbrellas(src: string, tok: (s: string) => string[]): UmbrellaClass[] {
  return src
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.includes('|'))
    .map((l) => {
      const [aliases, vocab] = l.split('|');
      return {
        aliases: new Set(aliases.split(',').flatMap((a) => tok(a))),
        vocab: new Set(vocab.split(',').flatMap((w) => tok(w))),
      };
    });
}

export function makeLexicon(umbrellas: readonly UmbrellaClass[]): Lexicon {
  return {
    /** Fraction of the member words that belong to the class a guess token names (0 if it names none). */
    umbrellaFraction(token, memberTokens) {
      let best = 0;
      for (const u of umbrellas) {
        if (!u.aliases.has(token)) continue;
        const hits = memberTokens.filter((m) => m.some((t) => u.vocab.has(t))).length;
        best = Math.max(best, memberTokens.length ? hits / memberTokens.length : 0);
      }
      return best;
    },
    /**
     * Sibling evidence: the guess token is itself an instance of a class ("sandwich" is food) that
     * most members also belong to. Returns that member fraction (0 when the token is in no shared class).
     */
    siblingFraction(token, memberTokens) {
      let best = 0;
      for (const u of umbrellas) {
        if (!u.vocab.has(token)) continue;
        const hits = memberTokens.filter((m) => m.some((t) => u.vocab.has(t))).length;
        best = Math.max(best, memberTokens.length ? hits / memberTokens.length : 0);
      }
      return best;
    },
  };
}

export const UMBRELLAS: readonly UmbrellaClass[] = parseUmbrellas(SRC, tokenize);

export const englishLexicon: Lexicon = makeLexicon(UMBRELLAS);
export const { umbrellaFraction, siblingFraction } = englishLexicon;
